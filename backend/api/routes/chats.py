from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from services.lesson_manager import get_lesson_by_id, get_student_visible_explanation
from pydantic import BaseModel
from typing import Optional
import json

from sqlalchemy.orm import Session, joinedload

from core.auth import get_current_user
from database import get_db
from models import Chat, Message, User
from services.rag_manager import RAGManager
from services import ai_engine

router = APIRouter(prefix="/chats", tags=["chats"])
rag = RAGManager()

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
        "mode": chat.mode,
        "tone": chat.tone,
        "created_at": chat.created_at.isoformat() if chat.created_at else None,
        "messages": [
            {
                "role": m.sender,
                "content": m.content,
                "created_at": m.created_at.isoformat() if m.created_at else None,
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
    title: str = "New Chat"
    mode: str = "direct"
    tone: str = "Professional Tutor"


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
        mode=body.mode,
        tone=body.tone,
    )

    db.add(chat)
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
    """Qdrant boş/çalışmıyorsa DB üzerinden materyal metnini doğrudan oku."""
    from services.course_manager import get_course_materials_text
    try:
        return get_course_materials_text(db, course_id) or ""
    except Exception:
        return ""


def _get_chat_context(db: Session, chat: Chat, question: str) -> str:
    if chat.lesson_id:
        approved_text = (get_student_visible_explanation(db, chat.lesson_id) or "").strip()
        if approved_text:
            return approved_text

        lesson = get_lesson_by_id(db, chat.lesson_id)
        if lesson:
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
            # RAG boş döndüyse lesson metnini disk'ten oku
            lesson_path = lesson.get("stored_path") or ""
            import os, json as _json
            sections_dir = "lesson_sections"
            safe_id = lesson.get("lesson_id", "").replace("::", "__").replace("/", "_").replace(" ", "_").replace(":", "_")
            sections_path = os.path.join(sections_dir, f"{safe_id}_sections.json")
            if os.path.exists(sections_path):
                try:
                    with open(sections_path, "r", encoding="utf-8") as f:
                        sections = _json.load(f)
                    return "\n\n".join(s.get("text", "") for s in sections)
                except Exception:
                    pass
        return ""

    # Materyal chat'i (lesson_id yok, sadece course_id var)
    if chat.course_id:
        # Önce RAG'dan dene
        if rag is not None:
            try:
                ctx = rag.query_context(question=question, course_id=chat.course_id)
                if ctx and ctx.strip():
                    return ctx
            except Exception:
                pass
        # RAG boşsa veya çalışmıyorsa DB'den direkt materyalleri oku
        return _get_materials_text_fallback(db, chat.course_id)

    return ""