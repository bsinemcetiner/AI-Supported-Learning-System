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


def _build_section_prompt(preview_question: str) -> str:
    return f"""
{preview_question}

Important:
- Write this as a spoken lesson script, not as a chatbot answer.
- Do not sound like an AI assistant.
- Use natural, connected paragraphs.
- Avoid bullet points unless absolutely necessary.
- Explain the topic like a teacher speaking directly to a student.
- Use smooth transitions such as "Now", "Let's move on", "At this point".
- Keep it clear, detailed, and human-like.
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
        db=db,
        course_id=course_id,
        teacher_username=current_user["username"],
        week_title=week_title,
        filename=file.filename,
        stored_path=stored_path,
        text_content=text,
    )

    if not ok:
        raise HTTPException(status_code=409, detail=msg)

    sections = _generate_section_titles_with_ai(pages)
    _save_sections(lesson_id, sections)

    try:
        rag.add_document(
            text=text,
            source_name=file.filename,
            course_id=course_id,
            teacher_username=current_user["username"],
        )
    except Exception:
        pass

    return {
        "lesson_id": lesson_id,
        "week_title": week_title,
        "filename": file.filename,
        "message": msg,
        "page_count": len(pages),
        "section_count": len(sections),
    }


@router.get("/course/{course_id}")
def list_lessons(
    course_id: str,
    _: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    lessons = get_lessons_by_course(db, course_id)
    return {
        lid: ldata
        for lid, ldata in lessons.items()
        if ldata.get("is_published", False)
    }


@router.get("/course/{course_id}/all")
def list_all_lessons(
    course_id: str,
    current_user: dict = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    return get_lessons_by_course(db, course_id)


@router.get("/{lesson_id}")
def get_lesson(
    lesson_id: str,
    _: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    lesson = get_lesson_by_id(db, lesson_id)
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    return lesson


@router.get("/{lesson_id}/sections")
def get_sections(
    lesson_id: str,
    current_user: dict = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    lesson = get_lesson_by_id(db, lesson_id)
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    sections = _load_sections(lesson_id)

    result = []
    for sec in sections:
        s = dict(sec)
        s["text_preview"] = s.get("text", "")[:200]
        s.pop("text", None)
        result.append(s)

    return {"sections": result, "total": len(result)}


@router.post("/{lesson_id}/sections/{section_index}/generate")
def generate_section(
    lesson_id: str,
    section_index: int,
    current_user: dict = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    lesson = get_lesson_by_id(db, lesson_id)
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    sections = _load_sections(lesson_id)

    if section_index < 0 or section_index >= len(sections):
        raise HTTPException(status_code=400, detail=f"Section index {section_index} out of range")

    section = sections[section_index]
    section_text = section.get("text", "")

    raw_preview_question = lesson.get(
        "preview_question",
        "Teach this lesson section as a natural spoken teaching script."
    )
    preview_question = _build_section_prompt(raw_preview_question)
    custom_prompt = lesson.get("custom_prompt", "")
    feedback_history = lesson.get("teacher_feedback_history", [])

    messages = [{"role": "user", "content": f"Please teach: {section.get('title', 'this section')}"}]

    def event_stream():
        full_reply = ""
        last_text = ""

        for cumulative in ai_engine.stream_ai_response(
            messages=messages,
            context=section_text,
            teaching_style="Professional Tutor",
            mode="direct",
            custom_prompt=preview_question + "\n\n" + custom_prompt,
            feedback_history=feedback_history,
        ):
            delta = cumulative[len(last_text):]
            last_text = cumulative
            full_reply += delta

            if delta:
                yield f"data: {json.dumps({'delta': delta, 'section_index': section_index})}\n\n"

        sections[section_index]["draft"] = full_reply
        sections[section_index]["approved"] = False
        _save_sections(lesson_id, sections)

        yield f"data: {json.dumps({'done': True, 'section_index': section_index})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.patch("/{lesson_id}/sections/{section_index}/approve")
def approve_section(
    lesson_id: str,
    section_index: int,
    current_user: dict = Depends(require_teacher),
    db: Session = Depends(get_db),
):
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

    return {
        "message": f"Section {section_index + 1} approved.",
        "section_index": section_index,
        "lesson_id": lesson_id,
    }


@router.patch("/{lesson_id}/sections/{section_index}/unapprove")
def unapprove_section(
    lesson_id: str,
    section_index: int,
    current_user: dict = Depends(require_teacher),
    db: Session = Depends(get_db),
):
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

    combined = "\n\n---\n\n".join([
        f"## {s['title']}\n\n{s['draft']}" for s in approved
    ])

    save_draft_explanation(db, lesson_id, combined)
    approve_lesson_explanation(db, lesson_id)

    return {
        "message": f"{len(approved)} sections published.",
        "lesson_id": lesson_id,
        "section_count": len(approved),
    }


class FeedbackRequest(BaseModel):
    feedback: str
    custom_prompt: Optional[str] = None


@router.post("/{lesson_id}/feedback")
def submit_feedback(
    lesson_id: str,
    body: FeedbackRequest,
    current_user: dict = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    lesson = get_lesson_by_id(db, lesson_id)
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    ok, msg = update_lesson_feedback(
        db=db,
        lesson_id=lesson_id,
        feedback_text=body.feedback,
        custom_prompt=body.custom_prompt,
    )

    if not ok:
        raise HTTPException(status_code=400, detail=msg)

    return {"message": msg, "lesson_id": lesson_id}


class PreviewQuestionRequest(BaseModel):
    preview_question: str


@router.patch("/{lesson_id}/preview-question")
def update_preview_question(
    lesson_id: str,
    body: PreviewQuestionRequest,
    current_user: dict = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    ok, msg = set_lesson_preview_question(db, lesson_id, body.preview_question)
    if not ok:
        raise HTTPException(status_code=404, detail=msg)
    return {"message": msg}


class PublishRequest(BaseModel):
    is_published: bool


@router.patch("/{lesson_id}/publish")
def toggle_publish(
    lesson_id: str,
    body: PublishRequest,
    current_user: dict = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    ok, msg = set_lesson_published(db, lesson_id, body.is_published)
    if not ok:
        raise HTTPException(status_code=404, detail=msg)
    return {"message": msg, "is_published": body.is_published}


@router.patch("/{lesson_id}/approve")
def approve_lesson(
    lesson_id: str,
    current_user: dict = Depends(require_teacher),
    db: Session = Depends(get_db),
):
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
def start_lesson_chat(
    lesson_id: str,
    body: StartLessonChatRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    lesson = get_lesson_by_id(db, lesson_id)
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    if not lesson.get("is_published", False):
        raise HTTPException(status_code=403, detail="This lesson is not published yet.")

    approved_text = (get_student_visible_explanation(db, lesson_id) or "").strip()
    if not approved_text:
        raise HTTPException(
            status_code=400,
            detail="This lesson does not have an approved explanation yet."
        )

    username = current_user["username"]
    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    existing_chat = (
        db.query(Chat)
        .filter(Chat.user_id == user.id, Chat.lesson_id == lesson_id)
        .order_by(Chat.created_at.desc())
        .first()
    )

    if existing_chat:
        existing_chat.mode = body.mode
        existing_chat.tone = body.tone
        db.commit()
        db.refresh(existing_chat)

        has_messages = db.query(Message).filter(Message.chat_id == existing_chat.id).count() > 0

        if not has_messages:
            starter_message = Message(
                chat_id=existing_chat.id,
                sender="assistant",
                content=approved_text,
            )
            db.add(starter_message)
            db.commit()

        return {
            "chat_id": str(existing_chat.id),
            "lesson_id": lesson_id,
            "week_title": lesson.get("week_title"),
            "starter_message": ""
        }

    chat = Chat(
        title=lesson.get("week_title", "Lesson Chat"),
        user_id=user.id,
        course_id=lesson.get("course_id"),
        lesson_id=lesson_id,
        mode=body.mode,
        tone=body.tone,
    )

    db.add(chat)
    db.commit()
    db.refresh(chat)

    starter_message = Message(
        chat_id=chat.id,
        sender="assistant",
        content=approved_text,
    )
    db.add(starter_message)
    db.commit()

    return {
        "chat_id": str(chat.id),
        "lesson_id": lesson_id,
        "week_title": lesson.get("week_title"),
        "starter_message": ""
    }