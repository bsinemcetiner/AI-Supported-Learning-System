from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from pypdf import PdfReader
from typing import Optional
import io
import json
import os
import re

from sqlalchemy.orm import Session

from core.auth import get_current_user, require_teacher
from database import get_db
from services.lesson_manager import (
    create_lesson,
    get_lessons_by_course,
    get_lesson_by_id,
    update_lesson_feedback,
    set_lesson_preview_question,
    set_lesson_published,
    save_draft_explanation,
    approve_lesson_explanation,
    get_student_visible_explanation,
    delete_lesson,
    delete_lessons_by_course,
)
from services.rag_manager import RAGManager
from models import Chat, Message, User
from services import ai_engine
from groq import Groq

router = APIRouter(prefix="/lessons", tags=["lessons"])
rag = RAGManager()

LESSON_MATERIALS_DIR = "lesson_materials"
LESSON_PDFS_DIR = "lesson_pdfs"
SECTIONS_DIR = "lesson_sections"


def _ensure_dirs():
    for d in [LESSON_MATERIALS_DIR, LESSON_PDFS_DIR, SECTIONS_DIR]:
        if not os.path.exists(d):
            os.makedirs(d)


def _safe_id(lesson_id: str) -> str:
    return lesson_id.replace("::", "__").replace("/", "_").replace(" ", "_").replace(":", "_")


def _read_pdf_bytes(file_bytes: bytes) -> str:
    try:
        reader = PdfReader(io.BytesIO(file_bytes))
        return "\n".join(
            p.extract_text() for p in reader.pages if p.extract_text()
        ).strip()
    except Exception:
        return ""


def _read_pdf_pages(file_bytes: bytes) -> list:
    try:
        reader = PdfReader(io.BytesIO(file_bytes))
        pages = []
        for page in reader.pages:
            text = page.extract_text()
            if text and text.strip():
                pages.append(text.strip())
        return pages
    except Exception:
        return []


def _get_sections_path(lesson_id: str) -> str:
    safe_id = _safe_id(lesson_id)
    return os.path.join(SECTIONS_DIR, f"{safe_id}_sections.json")


def _load_sections(lesson_id: str) -> list:
    path = _get_sections_path(lesson_id)
    if not os.path.exists(path):
        return []
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def _save_sections(lesson_id: str, sections: list):
    _ensure_dirs()
    path = _get_sections_path(lesson_id)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(sections, f, ensure_ascii=False)


def _split_pages_into_sections(pages: list) -> list:
    if not pages:
        return []
    total = len(pages)
    if total <= 5:
        pages_per_section = total
    elif total <= 15:
        pages_per_section = 3
    elif total <= 40:
        pages_per_section = 5
    else:
        pages_per_section = 8

    sections = []
    i = 0
    section_num = 1
    while i < total:
        end = min(i + pages_per_section, total)
        section_pages = pages[i:end]
        combined_text = "\n\n".join(section_pages)
        first_lines = section_pages[0].split("\n")[:3]
        title_guess = next((line.strip() for line in first_lines if len(line.strip()) > 3), f"Section {section_num}")
        sections.append({
            "section_index": section_num - 1,
            "title": title_guess[:60],
            "page_start": i + 1,
            "page_end": end,
            "text": combined_text,
            "summary": "",
            "draft": "",
            "approved": False,
        })
        i = end
        section_num += 1
    return sections


def _generate_section_titles_with_ai(pages: list) -> list:
    api_key = os.getenv("GROQ_API_KEY", "").strip()
    if not api_key:
        return _split_pages_into_sections(pages)

    page_summaries = []
    for i, page in enumerate(pages):
        first_line = page.split("\n")[0].strip()[:100]
        page_summaries.append(f"Page {i+1}: {first_line}")

    prompt = f"""You are analyzing a lecture PDF with {len(pages)} pages.
Here are the first lines of each page:

{chr(10).join(page_summaries)}

Group these pages into logical sections based on topic changes.
Return ONLY a JSON array, no other text. Format:
[
  {{"section_index": 0, "title": "Introduction & Overview", "page_start": 1, "page_end": 3, "summary": "Brief 1-sentence summary"}},
  {{"section_index": 1, "title": "Core Concepts", "page_start": 4, "page_end": 8, "summary": "Brief 1-sentence summary"}}
]

Rules:
- Group 2-8 pages per section
- Title must be concise (max 6 words)
- Summary must be 1 sentence max
- Return valid JSON only, nothing else"""

    try:
        client = Groq(api_key=api_key)
        response = client.chat.completions.create(
            model=os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile"),
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2,
            max_tokens=1000,
        )
        raw = response.choices[0].message.content or ""
        raw = raw.strip()
        if "```" in raw:
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        raw = raw.strip()
        ai_sections = json.loads(raw)
        sections = []
        for sec in ai_sections:
            start = sec["page_start"] - 1
            end = sec["page_end"]
            section_pages = pages[start:end]
            combined_text = "\n\n".join(section_pages)
            sections.append({
                "section_index": sec["section_index"],
                "title": sec["title"],
                "page_start": sec["page_start"],
                "page_end": sec["page_end"],
                "text": combined_text,
                "summary": sec.get("summary", ""),
                "draft": "",
                "approved": False,
            })
        return sections
    except Exception as e:
        print(f"AI section split failed: {e}, falling back to simple split")
        return _split_pages_into_sections(pages)


def _build_section_prompt(section_title: str, preview_question: str) -> str:
    return f"""You are creating a rich, visual, educational lesson page for the section titled: "{section_title}".

{preview_question}

OUTPUT FORMAT — STRICT RULES:
Return a JSON object with this exact structure. Do NOT include markdown, no code fences, no explanation — pure JSON only.

{{
  "hero_keyword": "2-4 word highly specific Unsplash search term for this topic",
  "learning_objectives": ["objective 1", "objective 2", "objective 3"],
  "slides": [
    {{
      "type": "intro",
      "title": "Section title here",
      "subtitle": "A compelling one-line hook",
      "image_keyword": "REQUIRED: 3-5 word specific Unsplash search term",
      "body": "2-3 sentence engaging introduction."
    }},
    {{
      "type": "concept",
      "title": "Key Concept Title",
      "image_keyword": null,
      "body": "Rich explanation paragraph (4-6 sentences).",
      "highlight": "The single most important takeaway sentence"
    }},
    {{
      "type": "deep_dive",
      "title": "Deep Dive: [Specific Aspect]",
      "image_keyword": "REQUIRED: 3-5 word specific term",
      "body": "Thorough explanation (5-7 sentences).",
      "highlight": "Key insight sentence"
    }},
    {{
      "type": "example",
      "title": "Code Example: [Topic]",
      "image_keyword": null,
      "body": "1-2 sentences explaining what this code demonstrates.",
      "code": "// Write actual working code here using \\n for newlines\\nConsole.WriteLine(\"example\");",
      "code_language": "c",
      "highlight": "Why this example matters"
    }},
    {{
      "type": "summary",
      "title": "Key Takeaways",
      "image_keyword": null,
      "points": ["Takeaway 1", "Takeaway 2", "Takeaway 3", "Takeaway 4"],
      "closing": "A motivating closing sentence."
    }}
  ]
}}

CRITICAL CODE RULES:
- The "code" field must be a plain JSON string — use \\n for newlines, NO backticks anywhere in the code field
- NEVER put backticks (```) inside any JSON string value
- All code goes in the "code" field only, never in "body"
- "body" fields must be plain text only, no code, no backticks

IMAGE KEYWORD RULES:
- ONLY "intro" and "deep_dive" slides get image_keyword values. All others must have "image_keyword": null

CONTENT RULES:
- Every slide body must be a real paragraph
- Minimum 5 slides, maximum 7 slides
- ALWAYS include at least one "example" slide with a "code" field containing real working code
- Return ONLY valid JSON — absolutely no text outside the JSON object
- "slides" MUST be a JSON array, NEVER a string

""".strip()


def _escape_newlines_inside_json_strings(raw: str) -> str:
    """
    LLMs sometimes return invalid JSON by placing real line breaks inside string values.
    This function keeps JSON structure intact and escapes only literal newlines that occur
    while we are inside a quoted JSON string.
    """
    result = []
    in_string = False
    escaped = False

    for ch in raw:
        if escaped:
            result.append(ch)
            escaped = False
            continue

        if ch == "\\" and in_string:
            result.append(ch)
            escaped = True
            continue

        if ch == '"':
            result.append(ch)
            in_string = not in_string
            continue

        if in_string and ch == "\n":
            result.append("\\n")
            continue

        if in_string and ch == "\r":
            result.append("\\r")
            continue

        result.append(ch)

    return "".join(result)


def _repair_code_string_newlines(code: str) -> str:
    """
    In C/C++/Java-like snippets, the model may accidentally turn printf("\\n")
    into a real newline inside the string literal. This repairs only newlines
    that occur inside double-quoted code strings, while preserving normal code
    line breaks between statements.
    """
    result = []
    in_string = False
    escaped = False

    for ch in code:
        if escaped:
            result.append(ch)
            escaped = False
            continue

        if ch == "\\" and in_string:
            result.append(ch)
            escaped = True
            continue

        if ch == '"':
            result.append(ch)
            in_string = not in_string
            continue

        if in_string and ch in ("\n", "\r"):
            result.append("\\n")
            continue

        result.append(ch)

    return "".join(result)


@router.post("/upload", status_code=201)
async def upload_lesson(
    course_id: str,
    week_title: str,
    file: UploadFile = File(...),
    current_user: dict = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    _ensure_dirs()
    content = await file.read()
    text = _read_pdf_bytes(content)
    if not text:
        raise HTTPException(status_code=422, detail=f"{file.filename}: could not extract text")

    safe_course = course_id.replace("::", "__").replace("/", "_")
    safe_week = week_title.strip().lower().replace(" ", "_")
    stored_filename = f"{safe_course}__{safe_week}.txt"
    stored_path = os.path.join(LESSON_MATERIALS_DIR, stored_filename)

    with open(stored_path, "w", encoding="utf-8") as f:
        f.write(text)
    pdf_filename = stored_filename.replace(".txt", ".pdf")
    pdf_path = os.path.join(LESSON_PDFS_DIR, pdf_filename)

    with open(pdf_path, "wb") as f:
        f.write(content)

    pages = _read_pdf_pages(content)
    pages_path = stored_path.replace(".txt", "_pages.json")
    with open(pages_path, "w", encoding="utf-8") as f:
        json.dump(pages, f, ensure_ascii=False)

    ok, msg, lesson_id = create_lesson(
        db=db, course_id=course_id, teacher_username=current_user["username"],
        week_title=week_title, filename=file.filename, stored_path=stored_path, text_content=text,
    )
    if not ok:
        raise HTTPException(status_code=409, detail=msg)

    sections = _generate_section_titles_with_ai(pages)
    _save_sections(lesson_id, sections)

    try:
        rag.add_document(text=text, source_name=file.filename, course_id=course_id, teacher_username=current_user["username"])
    except Exception:
        pass

    return {"lesson_id": lesson_id, "week_title": week_title, "filename": file.filename, "message": msg, "page_count": len(pages), "section_count": len(sections)}


@router.get("/course/{course_id}")
def list_lessons(course_id: str, _: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    lessons = get_lessons_by_course(db, course_id)
    return {lid: ldata for lid, ldata in lessons.items() if ldata.get("is_published", False)}


@router.get("/course/{course_id}/all")
def list_all_lessons(course_id: str, current_user: dict = Depends(require_teacher), db: Session = Depends(get_db)):
    return get_lessons_by_course(db, course_id)


@router.get("/{lesson_id}")
def get_lesson(lesson_id: str, _: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    lesson = get_lesson_by_id(db, lesson_id)
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    return lesson


@router.get("/{lesson_id}/sections")
def get_sections(lesson_id: str, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    lesson = get_lesson_by_id(db, lesson_id)
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    sections = _load_sections(lesson_id)
    is_teacher = current_user.get("role") == "teacher"
    result = []
    for sec in sections:
        s = dict(sec)
        if not is_teacher and not s.get("approved", False):
            continue
        s["text_preview"] = s.get("text", "")[:200]
        s.pop("text", None)
        result.append(s)
    return {"sections": result, "total": len(result)}


@router.post("/{lesson_id}/sections/{section_index}/generate")
def generate_section(lesson_id: str, section_index: int, current_user: dict = Depends(require_teacher), db: Session = Depends(get_db)):
    lesson = get_lesson_by_id(db, lesson_id)
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    sections = _load_sections(lesson_id)
    if section_index < 0 or section_index >= len(sections):
        raise HTTPException(status_code=400, detail=f"Section index {section_index} out of range")

    section = sections[section_index]
    section_text = section.get("text", "")
    section_title = section.get("title", "this section")
    raw_preview_question = lesson.get("preview_question", "Create a comprehensive, visually rich educational lesson page based on the provided content.")
    custom_prompt = lesson.get("custom_prompt", "")
    feedback_history = lesson.get("teacher_feedback_history", [])

    full_prompt = _build_section_prompt(
        section_title,
        "Create a comprehensive, visually rich educational lesson page based on the provided content."
    )
    if raw_preview_question:
        full_prompt += f"""

==============================
MANDATORY TEACHER MODIFICATIONS
==============================

The following teacher instructions are NOT optional. They are required constraints that must be visibly included in the generated lesson slides.

Teacher instructions:
{raw_preview_question}

STRICT REQUIREMENTS:
- You MUST satisfy every teacher instruction.
- Keep the original section topic, but modify the lesson according to the teacher instructions.
- If the teacher asks for a code example, create a dedicated "example" slide for it.
- If the teacher asks for a specific program, the code must solve exactly that program.
- Do NOT replace the teacher's requested example with a generic counting example.
- Do NOT ignore teacher-added educational content.
- Do NOT simply repeat examples from the source PDF unless the teacher asks for them.
- Before returning the final JSON, verify that the teacher request is visibly included in the slides.
- NEVER break the JSON structure.
- Return ONLY valid JSON.
- NEVER output markdown.
- NEVER use ``` code fences.
- Keep all code only inside the "code" field.
- Keep "body" fields as plain explanatory text only.
- In the "code" field, preserve normal code line breaks.
- For C printf newline characters, write \n inside the C string, for example: printf("Hello\n");
- Keep the response parseable JSON at all times.
"""
    if custom_prompt:
        full_prompt += f"\n\nADDITIONAL TEACHER INSTRUCTIONS:\n{custom_prompt}"

    messages = [{"role": "user", "content": f"Create the lesson page for section: {section_title}"}]

    # Keep enough source material for grounding, but avoid letting long PDF context
    # overpower the teacher's mandatory modifications or exceed Groq token limits.
    section_text_for_model = section_text[:5000]

    def event_stream():
        full_reply = ""
        last_text = ""
        for cumulative in ai_engine.stream_ai_response(
            messages=messages, context=section_text_for_model, teaching_style="Professional Tutor",
            mode="direct", custom_prompt=full_prompt, feedback_history=feedback_history,
        ):
            delta = cumulative[len(last_text):]
            last_text = cumulative
            full_reply += delta
            if delta:
                yield f"data: {json.dumps({'delta': delta, 'section_index': section_index})}\n\n"

        cleaned = full_reply.strip()

        # 1. Dış backtick fence temizle
        if "```" in cleaned:
            parts = cleaned.split("```")
            for part in parts:
                part = part.strip()
                if part.startswith("json"):
                    part = part[4:].strip()
                if part.startswith("{"):
                    cleaned = part
                    break

        # 2. Outermost { ... } al
        start = cleaned.find("{")
        end = cleaned.rfind("}")
        if start != -1 and end != -1 and end > start:
            cleaned = cleaned[start:end + 1]

        # 3. Parse, temizle, kaydet
        try:
            try:
                parsed = json.loads(cleaned)
            except json.JSONDecodeError:
                parsed = json.loads(_escape_newlines_inside_json_strings(cleaned))

            # slides string ise parse et
            if isinstance(parsed.get("slides"), str):
                try:
                    parsed["slides"] = json.loads(parsed["slides"])
                except Exception:
                    pass

            # code field'larındaki backtick'leri temizle
            if isinstance(parsed.get("slides"), list):
                for slide in parsed["slides"]:
                    if slide.get("code"):
                        code = slide["code"]
                        # Remove markdown code fences such as ```c, ```python, or plain ```
                        code = re.sub(r'^```[\w]*\s*', '', code.strip())
                        code = re.sub(r'\s*```$', '', code.strip())

                        # Repair accidental real newlines inside C string literals,
                        # for example: printf("Hello\n") stays correct in the rendered code.
                        code = _repair_code_string_newlines(code)

                        slide["code"] = code
                    # body içinde de backtick varsa temizle
                    if slide.get("body") and "```" in slide["body"]:
                        # body'den kodu çıkar, code field'ına taşı
                        body = slide["body"]
                        code_match = re.search(r'```([\w]*)\n([\s\S]*?)```', body)
                        if code_match and not slide.get("code"):
                            slide["code"] = code_match.group(2).strip()
                            slide["code_language"] = code_match.group(1) or "csharp"
                        # body'den kod bloğunu kaldır
                        slide["body"] = re.sub(r'```[\w]*\n[\s\S]*?```', '', body).strip()

            cleaned = json.dumps(parsed, ensure_ascii=False, separators=(',', ':'))
        except Exception:
            pass

        sections[section_index]["draft"] = cleaned
        sections[section_index]["approved"] = False
        _save_sections(lesson_id, sections)
        yield f"data: {json.dumps({'done': True, 'section_index': section_index})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.patch("/{lesson_id}/sections/{section_index}/approve")
def approve_section(lesson_id: str, section_index: int, current_user: dict = Depends(require_teacher), db: Session = Depends(get_db)):
    lesson = get_lesson_by_id(db, lesson_id)
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    sections = _load_sections(lesson_id)
    if section_index < 0 or section_index >= len(sections):
        raise HTTPException(status_code=400, detail=f"Section index {section_index} out of range")
    draft = sections[section_index].get("draft", "")
    if not draft.strip():
        raise HTTPException(status_code=400, detail="No draft to approve. Generate first.")
    sections[section_index]["approved"] = True
    _save_sections(lesson_id, sections)
    return {"message": f"Section {section_index + 1} approved.", "section_index": section_index, "lesson_id": lesson_id}


@router.patch("/{lesson_id}/sections/{section_index}/unapprove")
def unapprove_section(lesson_id: str, section_index: int, current_user: dict = Depends(require_teacher), db: Session = Depends(get_db)):
    sections = _load_sections(lesson_id)
    if section_index < 0 or section_index >= len(sections):
        raise HTTPException(status_code=400, detail="Invalid section index")
    sections[section_index]["approved"] = False
    sections[section_index]["draft"] = ""
    _save_sections(lesson_id, sections)
    return {"message": f"Section {section_index + 1} unapproved.", "section_index": section_index}


@router.patch("/{lesson_id}/publish-sections")
def publish_sections(
    lesson_id: str,
    current_user: dict = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    lesson = get_lesson_by_id(db, lesson_id)
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    sections = _load_sections(lesson_id)
    approved = [s for s in sections if s.get("approved") and s.get("draft", "").strip()]

    if not approved:
        raise HTTPException(status_code=400, detail="No approved sections. Approve at least one section first.")

    combined = json.dumps([
        {"title": s["title"], "draft": s["draft"], "section_index": s.get("section_index", 0),
         "page_start": s.get("page_start", 1), "page_end": s.get("page_end", 1)}
        for s in approved
    ], ensure_ascii=False)

    save_draft_explanation(db, lesson_id, combined)
    approve_lesson_explanation(db, lesson_id)

    try:
        from api.routes.notifications import create_notification
        course_id = lesson.get("course_id", "")
        week_title = lesson.get("week_title", "New Lesson")
        create_notification(
            db=db,
            course_id=course_id,
            title=f"New lesson published: {week_title}",
            message=f"{week_title} has been published with {len(approved)} section(s). Open it to start learning!",
            created_by=current_user["username"],
            type="new_lesson",
        )
    except Exception:
        pass

    return {
        "message": f"{len(approved)} sections published.",
        "lesson_id": lesson_id,
        "section_count": len(approved),
    }


class FeedbackRequest(BaseModel):
    feedback: str
    custom_prompt: Optional[str] = None


@router.post("/{lesson_id}/feedback")
def submit_feedback(lesson_id: str, body: FeedbackRequest, current_user: dict = Depends(require_teacher), db: Session = Depends(get_db)):
    lesson = get_lesson_by_id(db, lesson_id)
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    ok, msg = update_lesson_feedback(db=db, lesson_id=lesson_id, feedback_text=body.feedback, custom_prompt=body.custom_prompt)
    if not ok:
        raise HTTPException(status_code=400, detail=msg)
    return {"message": msg, "lesson_id": lesson_id}


class PreviewQuestionRequest(BaseModel):
    preview_question: str


@router.patch("/{lesson_id}/preview-question")
def update_preview_question(lesson_id: str, body: PreviewQuestionRequest, current_user: dict = Depends(require_teacher), db: Session = Depends(get_db)):
    ok, msg = set_lesson_preview_question(db, lesson_id, body.preview_question)
    if not ok:
        raise HTTPException(status_code=404, detail=msg)
    return {"message": msg}


class PublishRequest(BaseModel):
    is_published: bool


@router.patch("/{lesson_id}/publish")
def toggle_publish(lesson_id: str, body: PublishRequest, current_user: dict = Depends(require_teacher), db: Session = Depends(get_db)):
    ok, msg = set_lesson_published(db, lesson_id, body.is_published)
    if not ok:
        raise HTTPException(status_code=404, detail=msg)
    return {"message": msg, "is_published": body.is_published}


@router.patch("/{lesson_id}/approve")
def approve_lesson(lesson_id: str, current_user: dict = Depends(require_teacher), db: Session = Depends(get_db)):
    lesson = get_lesson_by_id(db, lesson_id)
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    ok, msg = approve_lesson_explanation(db, lesson_id)
    if not ok:
        raise HTTPException(status_code=400, detail=msg)
    return {"message": msg, "lesson_id": lesson_id, "is_published": True}


class StartLessonChatRequest(BaseModel):
    tone: str = "Professional Tutor"
    mode: str = "direct"


@router.post("/{lesson_id}/chat", status_code=201)
def start_lesson_chat(lesson_id: str, body: StartLessonChatRequest, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    lesson = get_lesson_by_id(db, lesson_id)
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    if not lesson.get("is_published", False):
        raise HTTPException(status_code=403, detail="This lesson is not published yet.")
    approved_text = (get_student_visible_explanation(db, lesson_id) or "").strip()
    if not approved_text:
        raise HTTPException(status_code=400, detail="This lesson does not have an approved explanation yet.")

    username = current_user["username"]
    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    existing_chat = (db.query(Chat).filter(Chat.user_id == user.id, Chat.lesson_id == lesson_id).order_by(Chat.created_at.desc()).first())
    if existing_chat:
        existing_chat.mode = body.mode
        existing_chat.tone = body.tone
        db.commit()
        db.refresh(existing_chat)
        has_messages = db.query(Message).filter(Message.chat_id == existing_chat.id).count() > 0
        if not has_messages:
            db.add(Message(chat_id=existing_chat.id, sender="assistant", content=approved_text))
            db.commit()
        return {"chat_id": str(existing_chat.id), "lesson_id": lesson_id, "week_title": lesson.get("week_title"), "starter_message": ""}

    chat = Chat(title=lesson.get("week_title", "Lesson Chat"), user_id=user.id, course_id=lesson.get("course_id"), lesson_id=lesson_id, mode=body.mode, tone=body.tone)
    db.add(chat)
    db.commit()
    db.refresh(chat)
    db.add(Message(chat_id=chat.id, sender="assistant", content=approved_text))
    db.commit()
    return {"chat_id": str(chat.id), "lesson_id": lesson_id, "week_title": lesson.get("week_title"), "starter_message": ""}


@router.delete("/course/{course_id}/all")
def delete_all_lessons_endpoint(
    course_id: str,
    current_user: dict = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    import os
    existing_lessons = get_lessons_by_course(db, course_id)
    for lesson_id in existing_lessons:
        sections_path = _get_sections_path(lesson_id)
        if os.path.exists(sections_path):
            try:
                os.remove(sections_path)
            except Exception:
                pass

    ok, msg = delete_lessons_by_course(db, course_id, current_user["username"])
    if not ok:
        raise HTTPException(status_code=404, detail=msg)
    return {"message": msg, "course_id": course_id}


@router.delete("/{lesson_id}")
def delete_lesson_endpoint(
    lesson_id: str,
    current_user: dict = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    import os
    sections_path = _get_sections_path(lesson_id)
    if os.path.exists(sections_path):
        try:
            os.remove(sections_path)
        except Exception:
            pass

    ok, msg = delete_lesson(db, lesson_id, current_user["username"])
    if not ok:
        raise HTTPException(status_code=404, detail=msg)
    return {"message": msg, "lesson_id": lesson_id}