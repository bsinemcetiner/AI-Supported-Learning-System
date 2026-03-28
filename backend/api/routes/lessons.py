from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from pypdf import PdfReader
from typing import Optional
import io
import json
import os

from core.auth import get_current_user, require_teacher
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
from services.chat_manager import (
    load_all_chats,
    create_new_chat,
    append_message,
)
from services import ai_engine

router = APIRouter(prefix="/lessons", tags=["lessons"])
rag = RAGManager()

LESSON_MATERIALS_DIR = "lesson_materials"


def _ensure_lesson_dir():
    if not os.path.exists(LESSON_MATERIALS_DIR):
        os.makedirs(LESSON_MATERIALS_DIR)


def _read_pdf_bytes(file_bytes: bytes) -> str:
    try:
        reader = PdfReader(io.BytesIO(file_bytes))
        return "\n".join(
            p.extract_text() for p in reader.pages if p.extract_text()
        ).strip()
    except Exception:
        return ""


def _build_spoken_preview_prompt(preview_question: str) -> str:
    return f"""
{preview_question}

Important:
- Write this as a spoken lesson script, not as a chatbot answer.
- Do not sound like an AI assistant.
- Use natural, connected paragraphs.
- Avoid bullet points unless absolutely necessary.
- Explain the topic like a teacher speaking directly to a student.
- Use smooth transitions such as "Now", "Let's move on", "At this point", when appropriate.
- Keep it clear, detailed, and human-like.
""".strip()


@router.post("/upload", status_code=201)
async def upload_lesson(
    course_id: str,
    week_title: str,
    file: UploadFile = File(...),
    current_user: dict = Depends(require_teacher),
):
    _ensure_lesson_dir()
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

    ok, msg, lesson_id = create_lesson(
        course_id=course_id,
        teacher_username=current_user["username"],
        week_title=week_title,
        filename=file.filename,
        stored_path=stored_path,
        text_content=text,
    )

    if not ok:
        raise HTTPException(status_code=409, detail=msg)

    rag.add_document(
        text=text,
        source_name=file.filename,
        course_id=course_id,
        teacher_username=current_user["username"],
    )

    return {
        "lesson_id": lesson_id,
        "week_title": week_title,
        "filename": file.filename,
        "message": msg,
    }


@router.get("/course/{course_id}")
def list_lessons(course_id: str, _: dict = Depends(get_current_user)):
    lessons = get_lessons_by_course(course_id)
    return {
        lid: ldata
        for lid, ldata in lessons.items()
        if ldata.get("is_published", False)
    }


@router.get("/course/{course_id}/all")
def list_all_lessons(course_id: str, current_user: dict = Depends(require_teacher)):
    return get_lessons_by_course(course_id)


@router.get("/{lesson_id}")
def get_lesson(lesson_id: str, _: dict = Depends(get_current_user)):
    lesson = get_lesson_by_id(lesson_id)
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    return lesson


@router.post("/{lesson_id}/preview")
def preview_lesson(
    lesson_id: str,
    current_user: dict = Depends(require_teacher),
):
    lesson = get_lesson_by_id(lesson_id)
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    stored_path = lesson.get("stored_path", "")
    lesson_text = ""
    if stored_path and os.path.exists(stored_path):
        with open(stored_path, "r", encoding="utf-8") as f:
            lesson_text = f.read()

    raw_preview_question = lesson.get(
        "preview_question",
        "Teach this lesson as a natural spoken teaching script."
    )
    preview_question = _build_spoken_preview_prompt(raw_preview_question)
    custom_prompt = lesson.get("custom_prompt", "")
    feedback_history = lesson.get("teacher_feedback_history", [])

    messages = [{"role": "user", "content": preview_question}]

    def event_stream():
        full_reply = ""
        last_text = ""

        for cumulative in ai_engine.stream_ai_response(
            messages=messages,
            context=lesson_text,
            teaching_style="Professional Tutor",
            mode="direct",
            custom_prompt=custom_prompt,
            feedback_history=feedback_history,
        ):
            delta = cumulative[len(last_text):]
            last_text = cumulative
            full_reply += delta

            if delta:
                yield f"data: {json.dumps({'delta': delta})}\n\n"

        save_draft_explanation(lesson_id, full_reply)
        yield f"data: {json.dumps({'done': True})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


class FeedbackRequest(BaseModel):
    feedback: str
    custom_prompt: Optional[str] = None


@router.post("/{lesson_id}/feedback")
def submit_feedback(
    lesson_id: str,
    body: FeedbackRequest,
    current_user: dict = Depends(require_teacher),
):
    lesson = get_lesson_by_id(lesson_id)
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    ok, msg = update_lesson_feedback(
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
):
    ok, msg = set_lesson_preview_question(lesson_id, body.preview_question)
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
):
    ok, msg = set_lesson_published(lesson_id, body.is_published)
    if not ok:
        raise HTTPException(status_code=404, detail=msg)
    return {"message": msg, "is_published": body.is_published}


@router.patch("/{lesson_id}/approve")
def approve_lesson(
    lesson_id: str,
    current_user: dict = Depends(require_teacher),
):
    lesson = get_lesson_by_id(lesson_id)
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    ok, msg = approve_lesson_explanation(lesson_id)
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
):
    lesson = get_lesson_by_id(lesson_id)
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    if not lesson.get("is_published", False):
        raise HTTPException(status_code=403, detail="This lesson is not published yet.")

    approved_text = (get_student_visible_explanation(lesson_id) or "").strip()
    if not approved_text:
        raise HTTPException(
            status_code=400,
            detail="This lesson does not have an approved explanation yet."
        )

    username = current_user["username"]
    all_chats = load_all_chats(username)

    chat_id = create_new_chat(
        username=username,
        all_chats=all_chats,
        course_id=lesson.get("course_id"),
        lesson_id=lesson_id,
        title=lesson.get("week_title", "Lesson Chat"),
        mode=body.mode,
        tone=body.tone,
    )

    append_message(username, all_chats, chat_id, "assistant", approved_text)

    return {
        "chat_id": chat_id,
        "lesson_id": lesson_id,
        "week_title": lesson.get("week_title"),
    }