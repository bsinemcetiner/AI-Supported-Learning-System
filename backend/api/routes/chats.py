from fastapi import APIRouter, Depends, HTTPException, File, UploadFile, Form
from fastapi.responses import StreamingResponse
from services.lesson_manager import get_lesson_by_id, get_student_visible_explanation
from services.ocr_service import ocr_service
from pydantic import BaseModel
from typing import Optional
import json
from pathlib import Path
import uuid

from sqlalchemy.orm import Session, joinedload

from core.auth import get_current_user
from database import get_db
from models import Chat, Message, User
from services.rag_manager import RAGManager
from services import ai_engine

router = APIRouter(prefix="/chats", tags=["chats"])
rag = RAGManager()

CHAT_IMAGE_UPLOAD_DIR = Path("uploads/chat_images")
CHAT_IMAGE_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

IMAGE_EXTENSIONS_BY_CONTENT_TYPE = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}

def _get_lesson_ai_params(db: Session, lesson_id: Optional[str]) -> dict:
    if not lesson_id:
        return {"custom_prompt": "", "feedback_history": []}

    lesson = get_lesson_by_id(db, lesson_id)
    if not lesson:
        return {"custom_prompt": "", "feedback_history": []}

    return {
        "custom_prompt": lesson.get("custom_prompt", "") or "",
        "feedback_history": lesson.get("teacher_feedback_history", []) or [],
    }

def _serialize_chat(chat: Chat) -> dict:
    return {
        "id": str(chat.id),
        "title": chat.title,
        "course_id": chat.course_id,
        "lesson_id": chat.lesson_id,
        "section_index": chat.section_index,
        "mode": chat.mode,
        "tone": chat.tone,
        "created_at": chat.created_at.isoformat() if chat.created_at else None,
        "messages": [
            {
                "role": m.sender,
                "content": m.content,
                "created_at": m.created_at.isoformat() if m.created_at else None,
                "image_url": (
                    f"http://127.0.0.1:8011/{m.image_path}"
                    if getattr(m, "image_path", None)
                    else None
                ),
                "image_original_name": getattr(m, "image_original_name", None),
                "extracted_image_text": getattr(m, "extracted_image_text", None),
            }
            for m in chat.messages
        ],
    }


def _get_db_user(db: Session, username: str) -> User:
    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.get("/")
def list_chats(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db_user = _get_db_user(db, current_user["username"])

    chats = (
        db.query(Chat)
        .options(joinedload(Chat.messages))
        .filter(Chat.user_id == db_user.id)
        .order_by(Chat.created_at.desc())
        .all()
    )

    return {str(chat.id): _serialize_chat(chat) for chat in chats}


class CreateChatRequest(BaseModel):
    course_id: Optional[str] = None
    lesson_id: Optional[str] = None
    section_index: Optional[int] = None
    title: str = "New Chat"
    mode: str = "direct"
    tone: str = "Professional Tutor"
    starter_message: Optional[str] = None


@router.post("/", status_code=201)
def create_chat(
    body: CreateChatRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db_user = _get_db_user(db, current_user["username"])

    chat = Chat(
        title=body.title,
        user_id=db_user.id,
        course_id=body.course_id,
        lesson_id=body.lesson_id,
        section_index=body.section_index,
        mode=body.mode,
        tone=body.tone,
    )

    db.add(chat)
    db.flush()

    starter = (body.starter_message or "").strip()
    if starter:
        starter_msg = Message(
            chat_id=chat.id,
            sender="assistant",
            content=starter,
        )
        db.add(starter_msg)

    db.commit()
    db.refresh(chat)

    return {"chat_id": str(chat.id)}


@router.delete("/{chat_id}")
def remove_chat(
    chat_id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db_user = _get_db_user(db, current_user["username"])

    chat = db.query(Chat).filter(Chat.id == chat_id, Chat.user_id == db_user.id).first()
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")

    db.delete(chat)
    db.commit()
    return {"message": "Chat deleted successfully."}


class RenameRequest(BaseModel):
    title: str


@router.patch("/{chat_id}/rename")
def rename(
    chat_id: int,
    body: RenameRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db_user = _get_db_user(db, current_user["username"])

    chat = db.query(Chat).filter(Chat.id == chat_id, Chat.user_id == db_user.id).first()
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")

    clean_title = body.title.strip()
    if not clean_title:
        raise HTTPException(status_code=400, detail="Chat title cannot be empty.")

    chat.title = clean_title
    db.commit()

    return {"message": "Chat renamed successfully."}


class SendMessageRequest(BaseModel):
    content: str
    stream: bool = True

ALLOWED_IMAGE_CONTENT_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
}

MAX_IMAGE_SIZE_MB = 5

@router.post("/{chat_id}/messages")
def send_message(
    chat_id: int,
    body: SendMessageRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db_user = _get_db_user(db, current_user["username"])

    chat = (
        db.query(Chat)
        .options(joinedload(Chat.messages))
        .filter(Chat.id == chat_id, Chat.user_id == db_user.id)
        .first()
    )
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")

    lesson_params = _get_lesson_ai_params(db, chat.lesson_id)

    user_message = Message(
        chat_id=chat.id,
        sender="user",
        content=body.content,
    )
    db.add(user_message)
    db.commit()

    db.refresh(chat)

    context = _get_chat_context(db, chat, body.content)
    if not context.strip():
        blocked_reply = (
            "This question is outside the uploaded lesson materials. "
            "Please ask something related to the course content."
        )

        if body.stream:
            def blocked_stream():
                yield f"data: {json.dumps({'delta': blocked_reply})}\n\n"
                yield f"data: {json.dumps({'done': True})}\n\n"

            return StreamingResponse(blocked_stream(), media_type="text/event-stream")

        assistant_message = Message(
            chat_id=chat.id,
            sender="assistant",
            content=blocked_reply,
        )
        db.add(assistant_message)
        db.commit()

        return {"role": "assistant", "content": blocked_reply}
    if chat.title == "New Chat":
        chat.title = body.content[:40]
        db.commit()

    messages_for_ai = [
        {"role": m.sender, "content": m.content}
        for m in chat.messages
    ]

    if not body.stream:
        reply = ai_engine.generate_ai_response(
            messages=messages_for_ai,
            context=context,
            teaching_style=chat.tone,
            mode=chat.mode,
            custom_prompt=lesson_params["custom_prompt"],
            feedback_history=lesson_params["feedback_history"],
        )

        assistant_message = Message(
            chat_id=chat.id,
            sender="assistant",
            content=reply,
        )
        db.add(assistant_message)
        db.commit()

        return {"role": "assistant", "content": reply}

    def event_stream():
        full_reply = ""
        last_text = ""

        for cumulative in ai_engine.stream_ai_response(
            messages=messages_for_ai,
            context=context,
            teaching_style=chat.tone,
            mode=chat.mode,
            custom_prompt=lesson_params["custom_prompt"],
            feedback_history=lesson_params["feedback_history"],
        ):
            delta = cumulative[len(last_text):]
            last_text = cumulative
            full_reply += delta

            if delta:
                yield f"data: {json.dumps({'delta': delta})}\n\n"

        db2 = next(get_db())
        try:
            assistant_message = Message(
                chat_id=chat.id,
                sender="assistant",
                content=full_reply,
            )
            db2.add(assistant_message)
            db2.commit()
        finally:
            db2.close()

        yield f"data: {json.dumps({'done': True})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")

@router.post("/{chat_id}/image-question")
async def send_image_question(
    chat_id: int,
    question: str = Form(...),
    stream: bool = Form(True),
    image: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db_user = _get_db_user(db, current_user["username"])

    chat = (
        db.query(Chat)
        .options(joinedload(Chat.messages))
        .filter(Chat.id == chat_id, Chat.user_id == db_user.id)
        .first()
    )

    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")

    if image.content_type not in ALLOWED_IMAGE_CONTENT_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Only JPEG, PNG, and WEBP image files are allowed."
        )

    file_bytes = await image.read()

    max_size_bytes = MAX_IMAGE_SIZE_MB * 1024 * 1024
    if len(file_bytes) > max_size_bytes:
        raise HTTPException(
            status_code=400,
            detail=f"Image size must be smaller than {MAX_IMAGE_SIZE_MB} MB."
        )

    clean_question = question.strip()
    if not clean_question:
        raise HTTPException(
            status_code=400,
            detail="Question cannot be empty."
        )

    extracted_text = ocr_service.extract_text(
        file_bytes=file_bytes,
        filename=image.filename or "uploaded_image.png"
    ).strip()

    extension = IMAGE_EXTENSIONS_BY_CONTENT_TYPE.get(image.content_type, ".png")
    stored_filename = f"{uuid.uuid4().hex}{extension}"
    stored_path = CHAT_IMAGE_UPLOAD_DIR / stored_filename

    with open(stored_path, "wb") as f:
        f.write(file_bytes)

    image_path = f"uploads/chat_images/{stored_filename}"

    user_message = Message(
        chat_id=chat.id,
        sender="user",
        content=clean_question,
        image_path=image_path,
        image_original_name=image.filename,
        extracted_image_text=extracted_text,
    )

    db.add(user_message)
    db.commit()

    if chat.title == "New Chat":
        chat.title = clean_question[:40]
        db.commit()

    db.refresh(chat)

    chat = (
        db.query(Chat)
        .options(joinedload(Chat.messages))
        .filter(Chat.id == chat_id, Chat.user_id == db_user.id)
        .first()
    )

    lesson_params = _get_lesson_ai_params(db, chat.lesson_id)

    image_context = f"""
    The student uploaded an image/screenshot.

    OCR text extracted from the uploaded image:
    {extracted_text}

    Important rules:
    - The student's question is about the uploaded image.
    - Use the OCR text above as the primary source.
    - Do NOT answer from previous chat messages, lesson materials, or course materials unless the student explicitly asks to connect the image with the lesson.
    - If the OCR text is incomplete or unclear, say that the screenshot text is partly unclear and explain only what can be read.
    """.strip()

    question_lower = clean_question.lower()

    wants_course_connection = any(
        phrase in question_lower
        for phrase in [
            "according to the lesson",
            "according to course",
            "course material",
            "lesson material",
            "relate to the lesson",
            "connect to the lesson",
            "compare with the lesson",
        ]
    )

    if wants_course_connection:
        lesson_context = _get_chat_context(db, chat, clean_question)

        if lesson_context and lesson_context.strip():
            context = f"""
    Uploaded image context:
    {image_context}

    Relevant course / lesson context:
    {lesson_context}

    Use the uploaded image as the main source. Use the course context only to support or connect the explanation.
    """.strip()
        else:
            context = image_context
    else:
        context = image_context

    messages_for_ai = [
        {
            "role": "user",
            "content": f"""
    The student uploaded an image/screenshot and asked:

    {clean_question}

    OCR text extracted from the uploaded image:

    {extracted_text}

    Answer based on the uploaded image content.
    """.strip(),
        }
    ]

    if not stream:
        reply = ai_engine.generate_ai_response(
            messages=messages_for_ai,
            context=context,
            teaching_style=chat.tone,
            mode=chat.mode,
            custom_prompt=lesson_params["custom_prompt"],
            feedback_history=lesson_params["feedback_history"],
        )

        assistant_message = Message(
            chat_id=chat.id,
            sender="assistant",
            content=reply,
        )

        db.add(assistant_message)
        db.commit()

        return {
            "role": "assistant",
            "content": reply,
            "extracted_text": extracted_text,
        }

    def event_stream():
        full_reply = ""
        last_text = ""

        for cumulative in ai_engine.stream_ai_response(
            messages=messages_for_ai,
            context=context,
            teaching_style=chat.tone,
            mode=chat.mode,
            custom_prompt=lesson_params["custom_prompt"],
            feedback_history=lesson_params["feedback_history"],
        ):
            delta = cumulative[len(last_text):]
            last_text = cumulative
            full_reply += delta

            if delta:
                yield f"data: {json.dumps({'delta': delta})}\n\n"

        db2 = next(get_db())
        try:
            assistant_message = Message(
                chat_id=chat.id,
                sender="assistant",
                content=full_reply,
            )
            db2.add(assistant_message)
            db2.commit()
        finally:
            db2.close()

        yield f"data: {json.dumps({'done': True, 'extracted_text': extracted_text})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")

@router.post("/{chat_id}/regenerate")
def regenerate(
    chat_id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db_user = _get_db_user(db, current_user["username"])

    chat = (
        db.query(Chat)
        .options(joinedload(Chat.messages))
        .filter(Chat.id == chat_id, Chat.user_id == db_user.id)
        .first()
    )
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")

    if len(chat.messages) < 2 or chat.messages[-1].sender != "assistant":
        raise HTTPException(status_code=400, detail="Nothing to regenerate")

    last_user_msg = None
    for m in reversed(chat.messages):
        if m.sender == "user":
            last_user_msg = m.content
            break

    if not last_user_msg:
        raise HTTPException(status_code=400, detail="No user message found")

    db.delete(chat.messages[-1])
    db.commit()

    db.refresh(chat)

    context = _get_chat_context(db, chat, last_user_msg)
    lesson_params = _get_lesson_ai_params(db, chat.lesson_id)

    def event_stream():
        full_reply = ""
        last_text = ""

        messages_for_ai = [
            {"role": m.sender, "content": m.content}
            for m in chat.messages
        ]

        for cumulative in ai_engine.stream_ai_response(
            messages=messages_for_ai,
            context=context,
            teaching_style=chat.tone,
            mode=chat.mode,
            custom_prompt=lesson_params["custom_prompt"],
            feedback_history=lesson_params["feedback_history"],
        ):
            delta = cumulative[len(last_text):]
            last_text = cumulative
            full_reply += delta

            if delta:
                yield f"data: {json.dumps({'delta': delta})}\n\n"

        db2 = next(get_db())
        try:
            assistant_message = Message(
                chat_id=chat.id,
                sender="assistant",
                content=full_reply,
            )
            db2.add(assistant_message)
            db2.commit()
        finally:
            db2.close()

        yield f"data: {json.dumps({'done': True})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


class UpdateSettingsRequest(BaseModel):
    mode: Optional[str] = None
    tone: Optional[str] = None


@router.patch("/{chat_id}/settings")
def update_settings(
    chat_id: int,
    body: UpdateSettingsRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db_user = _get_db_user(db, current_user["username"])

    chat = db.query(Chat).filter(Chat.id == chat_id, Chat.user_id == db_user.id).first()
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")

    if body.mode is not None:
        chat.mode = body.mode
    if body.tone is not None:
        chat.tone = body.tone

    db.commit()
    return {"message": "Settings updated"}

def _get_materials_text_fallback(db: Session, course_id: str) -> str:
    """If Qdrant is empty/not working, read the material text directly from the DB"""
    from services.course_manager import get_course_materials_text
    try:
        return get_course_materials_text(db, course_id) or ""
    except Exception:
        return ""


def _get_chat_context(db: Session, chat: Chat, question: str) -> str:
    if chat.lesson_id:
        lesson = get_lesson_by_id(db, chat.lesson_id)
        if not lesson:
            return ""

        import os
        import json as _json

        safe_id = (
            lesson.get("lesson_id", "")
            .replace("::", "__")
            .replace("/", "_")
            .replace(" ", "_")
            .replace(":", "_")
        )

        sections_path = os.path.join("lesson_sections", f"{safe_id}_sections.json")


        if chat.section_index is not None:
            if os.path.exists(sections_path):
                try:
                    with open(sections_path, "r", encoding="utf-8") as f:
                        sections = _json.load(f)

                    if 0 <= chat.section_index < len(sections):
                        section = sections[chat.section_index]

                        section_title = section.get("title", f"Section {chat.section_index + 1}")
                        page_start = section.get("page_start", "")
                        page_end = section.get("page_end", "")

                        section_text = (
                            section.get("draft", "")
                            or section.get("approved_text", "")
                            or section.get("text", "")
                            or section.get("text_preview", "")
                            or section.get("summary", "")
                        ).strip()

                        if section_text:
                            return f"""
Lesson: {lesson.get("week_title", "")}
Section: {section_title}
Pages: {page_start}-{page_end}

Only answer based on this section. Do not use other parts of the lesson unless the student explicitly asks for a general comparison.

Section content:
{section_text}
""".strip()

                except Exception:
                    pass

            return ""


        approved_text = (get_student_visible_explanation(db, chat.lesson_id) or "").strip()
        if approved_text:
            return approved_text

        try:
            ctx = rag.query_context(
                question=question,
                course_id=chat.course_id,
                source_name=lesson.get("original_filename"),
            )
            if ctx and ctx.strip():
                return ctx
        except Exception:
            pass

        if os.path.exists(sections_path):
            try:
                with open(sections_path, "r", encoding="utf-8") as f:
                    sections = _json.load(f)

                return "\n\n".join(
                    (
                        s.get("draft", "")
                        or s.get("approved_text", "")
                        or s.get("text", "")
                        or s.get("text_preview", "")
                        or s.get("summary", "")
                    )
                    for s in sections
                ).strip()
            except Exception:
                pass

        return ""

    if chat.course_id:
        if rag is not None:
            try:
                ctx = rag.query_context(question=question, course_id=chat.course_id)
                if ctx and ctx.strip():
                    return ctx
            except Exception:
                pass
        return _get_materials_text_fallback(db, chat.course_id)

    return ""