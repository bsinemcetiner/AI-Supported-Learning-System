from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from pypdf import PdfReader
from typing import Optional
import io
import json
import os

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
)
from services.rag_manager import RAGManager
from models import Chat, Message, User
from services import ai_engine


def _stream_section_direct(system_prompt: str, section_text: str, section_title: str):
    """Lightweight Groq call for section generation — skips the heavy ai_engine system prompt."""
    import os
    from groq import Groq
    client = Groq(api_key=os.getenv("GROQ_API_KEY", "").strip())
    model = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile").strip()

    # Trim section text to keep tokens low
    text = section_text.strip()
    if len(text) > 4000:
        text = text[:4000] + "\n\n[Content truncated.]"

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"Section title: {section_title}\n\nSection content:\n{text}\n\nGenerate the lesson page JSON now."},
    ]

    stream = client.chat.completions.create(
        model=model,
        messages=messages,
        temperature=0.4,
        stream=True,
        max_tokens=1800,
    )

    full = ""
    for chunk in stream:
        delta = chunk.choices[0].delta.content or ""
        if delta:
            full += delta
            yield full
from groq import Groq

router = APIRouter(prefix="/lessons", tags=["lessons"])
rag = RAGManager()

LESSON_MATERIALS_DIR = "lesson_materials"
SECTIONS_DIR = "lesson_sections"


def _ensure_dirs():
    for d in [LESSON_MATERIALS_DIR, SECTIONS_DIR]:
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
  "hero_keyword": "2-4 word highly specific Unsplash search term for this topic (e.g. 'computer memory chip closeup', 'neural network visualization', 'paging memory diagram')",
  "learning_objectives": ["objective 1", "objective 2", "objective 3"],
  "slides": [
    {{
      "type": "intro",
      "title": "Section title here",
      "subtitle": "A compelling one-line hook that makes the student want to read on",
      "image_keyword": "REQUIRED: 3-5 word highly specific Unsplash search term — must be visually concrete and directly related to THIS topic. Good: 'computer memory allocation diagram'. Bad: 'technology', 'education', 'learning'",
      "body": "2-3 sentence engaging introduction. Set the scene, explain why this matters."
    }},
    {{
      "type": "concept",
      "title": "Key Concept Title",
      "image_keyword": null,
      "body": "Rich explanation paragraph (4-6 sentences). Be detailed and clear. Explain WHY, not just WHAT.",
      "highlight": "The single most important takeaway sentence from this slide"
    }},
    {{
      "type": "deep_dive",
      "title": "Deep Dive: [Specific Aspect]",
      "image_keyword": "REQUIRED: 3-5 word highly specific term for a diagram/visual that directly illustrates the mechanism being explained. Good: 'page table virtual memory', 'TLB cache lookup diagram'. Bad: 'computer', 'science'",
      "body": "Thorough explanation (5-7 sentences). Include mechanisms, processes, or underlying principles.",
      "highlight": "Key insight sentence"
    }},
    {{
      "type": "example",
      "title": "Real-World Example",
      "image_keyword": null,
      "body": "Concrete example with context (3-5 sentences). Make it tangible and relatable. Do NOT put code here.",
      "code": null,
      "code_language": null,
      "highlight": "Why this example matters"
    }},
    {{
      "type": "comparison",
      "title": "Comparison / Contrast",
      "image_keyword": null,
      "table": {{
        "headers": ["Aspect", "Option A", "Option B"],
        "rows": [
          ["row1 aspect", "A value", "B value"],
          ["row2 aspect", "A value", "B value"],
          ["row3 aspect", "A value", "B value"]
        ]
      }},
      "highlight": "Key insight from the comparison"
    }},
    {{
      "type": "summary",
      "title": "Key Takeaways",
      "image_keyword": null,
      "points": ["Takeaway 1 (full sentence)", "Takeaway 2 (full sentence)", "Takeaway 3 (full sentence)", "Takeaway 4 (full sentence)"],
      "closing": "A motivating closing sentence connecting this section to the bigger picture."
    }}
  ]
}}

IMAGE KEYWORD RULES (CRITICAL):
- ONLY "intro" and "deep_dive" slides get image_keyword values. ALL other slide types must have "image_keyword": null
- image_keyword must be 3-5 words, highly specific to the exact concept (not generic)
- Think: what would a textbook diagram of this concept look like? Use that as the keyword.
- Examples of GOOD keywords: "paging memory management", "TCP three way handshake", "binary search tree traversal", "CPU pipeline stages"
- Examples of BAD keywords: "computer", "technology", "diagram", "concept", "learning"

CONTENT RULES:
- Every slide body must be a real paragraph — no shallow one-liners
- Include comparison table ONLY if genuinely useful; otherwise replace with another concept or deep_dive slide
- Minimum 5 slides, maximum 7 slides
- Return ONLY valid JSON — absolutely no text outside the JSON object
- If a code example is required, put the code in the "code" field and the language in "code_language".
- Never put code blocks, markdown fences, or backticks inside the "body" field.
- The "body" field must contain explanation text only.
""".strip()


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

    # Kod isteği var mı kontrol et
    combined_instructions = (custom_prompt or "") + " " + (raw_preview_question or "")
    code_keywords = ["code", "program", "write a", "write the", "example of", "implement",
                     "function", "script", "printf", "scanf", "int main", "using", "class ",
                     "def ", "import ", "kodla", "yaz", "örnek", "uygula"]
    # custom_prompt'ta kod isteği varsa kesinlikle kod üret
    needs_code = any(kw in combined_instructions.lower() for kw in code_keywords)

    # Kod isteğini JSON prompt'tan ayır
    json_prompt = _build_section_prompt(section_title, raw_preview_question)
    json_prompt += """\n\nIMPORTANT JSON RULES:
- Do NOT use backtick fences (```) anywhere inside JSON string values - this breaks JSON parsing
- Do NOT use inline backticks (`) for code terms inside JSON strings - write them as plain text
- Write command names, variable names, and code terms as plain text in body fields
- The backend will handle code display separately"""
    if custom_prompt:
        # Kod isteğini filtrele, sadece stil talimatlarını bırak
        style_only = custom_prompt
        for kw in ["write a", "include code", "give code", "show code", "example of code", "program using", "code example"]:
            style_only = style_only.replace(kw, "")
        json_prompt += f"\n\nADDITIONAL TEACHER INSTRUCTIONS:\n{style_only}"

    def event_stream():
        import json as _json

        full_reply = ""
        last_text = ""
        for cumulative in _stream_section_direct(json_prompt, section_text, section_title):
            delta = cumulative[len(last_text):]
            last_text = cumulative
            full_reply += delta
            if delta:
                yield f"data: {_json.dumps({'delta': delta, 'section_index': section_index})}\n\n"

        # JSON temizle
        cleaned = full_reply.strip()
        if cleaned.startswith("```"):
            first_nl = cleaned.find("\n")
            if first_nl != -1:
                cleaned = cleaned[first_nl+1:]
            if cleaned.endswith("```"):
                cleaned = cleaned[:-3].strip()

        s = cleaned.find("{")
        e = cleaned.rfind("}")
        if s != -1 and e != -1 and e > s:
            cleaned = cleaned[s:e+1]

        # Char-by-char fix
        out = []
        in_str = False
        i = 0
        while i < len(cleaned):
            c = cleaned[i]
            if c == "\\" and i + 1 < len(cleaned):
                out.append(c); out.append(cleaned[i+1]); i += 2; continue
            if c == '"':
                in_str = not in_str
            if in_str and c == "\n":
                out.append("\\n")
            elif in_str and c == "\r":
                pass
            else:
                out.append(c)
            i += 1

        try:
            parsed = _json.loads("".join(out))
        except Exception:
            try:
                parsed = _json.loads(cleaned)
            except Exception:
                parsed = None

        # Kod isteği varsa Groq'a ayrı istek at
        if needs_code and parsed:
            try:
                lang_hint = ""
                cp_lower = combined_instructions.lower()
                for lang in ["c#", "python", "java", "javascript", "typescript", "bash", "sql", "c++"]:
                    if lang in cp_lower:
                        lang_hint = lang
                        break
                if not lang_hint:
                    c_patterns = ["c program", "c language", "c code",
                                  "#include", "printf", "scanf", "int main", "stdlib", "stdio"]
                    if any(p in cp_lower for p in c_patterns):
                        lang_hint = "c"

                code_request = f"""You are creating a code example for an educational lesson slide.

SECTION TITLE: "{section_title}"
TEACHER INSTRUCTION: {combined_instructions}
LANGUAGE: {lang_hint if lang_hint else "the most appropriate language for this topic"}

SECTION CONTENT (use this to understand the topic and write a relevant example):
{section_text[:3000]}

Rules:
- Write a complete, working code example DIRECTLY related to the section content above
- The code must illustrate the specific concept from this section, not a generic example
- Return ONLY the code block with proper markdown fences
- Use ```{lang_hint if lang_hint else ""} at the start and ``` at the end
- No explanation text before or after — ONLY the code block
"""
                client = ai_engine._get_client()
                code_resp = client.chat.completions.create(
                    model=ai_engine._get_model_name(),
                    messages=[{"role": "user", "content": code_request}],
                    temperature=0.2,
                    stream=False,
                )
                code_text = code_resp.choices[0].message.content or ""
                code_text = code_text.strip()

                # Example slide'a code field olarak ekle
                for slide in parsed.get("slides", []):
                    if slide.get("type") == "example":
                        clean_code = code_text.strip()

                        # Opening/closing markdown fences'i kaldır: ```c ... ```
                        if clean_code.startswith("```"):
                            lines = clean_code.splitlines()

                            if lines and lines[0].strip().startswith("```"):
                                lines = lines[1:]

                            if lines and lines[-1].strip() == "```":
                                lines = lines[:-1]

                            clean_code = "\n".join(lines).strip()

                        slide["code"] = clean_code
                        slide["code_language"] = lang_hint if lang_hint else "code"
                        break
            except Exception as e:
                import traceback
                print(f"[CODE GEN ERROR] {e}")
                traceback.print_exc()

        if parsed:
            cleaned = _json.dumps(parsed, ensure_ascii=False)

        sections[section_index]["draft"] = cleaned
        sections[section_index]["approved"] = False
        _save_sections(lesson_id, sections)
        yield f"data: {_json.dumps({'done': True, 'section_index': section_index})}\n\n"

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
# Bu fonksiyonu lessons.py içindeki publish_sections ile değiştir

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

    # ── Auto-notification ──────────────────────────────────────────────
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
        pass  # Never fail the publish because of notification error
    # ──────────────────────────────────────────────────────────────────

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