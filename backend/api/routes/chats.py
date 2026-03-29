from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional
import json

from core.auth import get_current_user
from services.chat_manager import (
    load_all_chats,
    save_all_chats,
    create_new_chat,
    delete_chat,
    rename_chat,
    append_message,
)
from services.rag_manager import RAGManager
from services.lesson_manager import get_lesson_by_id
from services import ai_engine

router = APIRouter(prefix="/chats", tags=["chats"])
rag = RAGManager()


def _get_lesson_ai_params(lesson_id: Optional[str]) -> dict:
    """
    Fetches custom_prompt and feedback_history from a lesson if lesson_id is set.
    Returns empty defaults if not found.
    """
    if not lesson_id:
        return {"custom_prompt": "", "feedback_history": []}

    lesson = get_lesson_by_id(lesson_id)
    if not lesson:
        return {"custom_prompt": "", "feedback_history": []}

    return {
        "custom_prompt": lesson.get("custom_prompt", ""),
        "feedback_history": lesson.get("teacher_feedback_history", []),
    }


# ── GET /chats ── kullanıcının tüm chatları
@router.get("/")
def list_chats(current_user: dict = Depends(get_current_user)):
    return load_all_chats(current_user["username"])


# ── POST /chats ── yeni chat
class CreateChatRequest(BaseModel):
    course_id: Optional[str] = None
    lesson_id: Optional[str] = None
    title: str = "New Chat"
    mode: str = "direct"
    tone: str = "Professional Tutor"


@router.post("/", status_code=201)
def create_chat(body: CreateChatRequest, current_user: dict = Depends(get_current_user)):
    username  = current_user["username"]
    all_chats = load_all_chats(username)
    chat_id   = create_new_chat(
        username=username,
        all_chats=all_chats,
        course_id=body.course_id,
        lesson_id=body.lesson_id,
        title=body.title,
        mode=body.mode,
        tone=body.tone,
    )
    return {"chat_id": chat_id}


# ── DELETE /chats/{chat_id} ── chat sil
@router.delete("/{chat_id}")
def remove_chat(chat_id: str, current_user: dict = Depends(get_current_user)):
    username  = current_user["username"]
    all_chats = load_all_chats(username)
    ok, msg   = delete_chat(username, all_chats, chat_id)
    if not ok:
        raise HTTPException(status_code=404, detail=msg)
    return {"message": msg}


# ── PATCH /chats/{chat_id}/rename ── yeniden adlandır
class RenameRequest(BaseModel):
    title: str


@router.patch("/{chat_id}/rename")
def rename(chat_id: str, body: RenameRequest, current_user: dict = Depends(get_current_user)):
    username  = current_user["username"]
    all_chats = load_all_chats(username)
    ok, msg   = rename_chat(username, all_chats, chat_id, body.title)
    if not ok:
        raise HTTPException(status_code=400, detail=msg)
    return {"message": msg}


# ── POST /chats/{chat_id}/messages ── mesaj gönder (streaming)
class SendMessageRequest(BaseModel):
    content: str
    stream: bool = True


@router.post("/{chat_id}/messages")
def send_message(
    chat_id: str,
    body: SendMessageRequest,
    current_user: dict = Depends(get_current_user),
):
    username  = current_user["username"]
    all_chats = load_all_chats(username)

    if chat_id not in all_chats:
        raise HTTPException(status_code=404, detail="Chat not found")

    chat      = all_chats[chat_id]
    course_id = chat.get("course_id")
    lesson_id = chat.get("lesson_id")
    tone      = chat.get("tone", "Professional Tutor")
    mode      = chat.get("mode", "direct")

    # Lesson'dan custom_prompt ve feedback_history çek
    lesson_params = _get_lesson_ai_params(lesson_id)

    # Kullanıcı mesajını ekle ve kaydet
    append_message(username, all_chats, chat_id, "user", body.content)
    all_chats = load_all_chats(username)
    chat      = all_chats[chat_id]

    # RAG bağlamı
    context = rag.query_context(question=body.content, course_id=course_id)

    # Auto-title
    if chat.get("title") == "New Chat":
        chat["title"] = body.content[:40]
        save_all_chats(username, all_chats)

    if not body.stream:
        reply = ai_engine.generate_ai_response(
            messages=chat["messages"],
            context=context,
            teaching_style=tone,
            mode=mode,
            custom_prompt=lesson_params["custom_prompt"],
            feedback_history=lesson_params["feedback_history"],
        )
        append_message(username, all_chats, chat_id, "assistant", reply)
        return {"role": "assistant", "content": reply}

    # Streaming yanıt — Server-Sent Events
    def event_stream():
        full_reply = ""
        last_text  = ""
        messages   = chat["messages"]

        for cumulative in ai_engine.stream_ai_response(
            messages=messages,
            context=context,
            teaching_style=tone,
            mode=mode,
            custom_prompt=lesson_params["custom_prompt"],
            feedback_history=lesson_params["feedback_history"],
        ):
            delta     = cumulative[len(last_text):]
            last_text = cumulative
            full_reply += delta
            if delta:
                yield f"data: {json.dumps({'delta': delta})}\n\n"

        reload = load_all_chats(username)
        append_message(username, reload, chat_id, "assistant", full_reply)
        yield f"data: {json.dumps({'done': True})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


# ── POST /chats/{chat_id}/regenerate ── son yanıtı yeniden üret
@router.post("/{chat_id}/regenerate")
def regenerate(chat_id: str, current_user: dict = Depends(get_current_user)):
    username  = current_user["username"]
    all_chats = load_all_chats(username)

    if chat_id not in all_chats:
        raise HTTPException(status_code=404, detail="Chat not found")

    chat      = all_chats[chat_id]
    messages  = chat.get("messages", [])
    lesson_id = chat.get("lesson_id")

    if len(messages) < 2 or messages[-1]["role"] != "assistant":
        raise HTTPException(status_code=400, detail="Nothing to regenerate")

    last_user = next(m["content"] for m in reversed(messages) if m["role"] == "user")
    chat["messages"] = messages[:-1]
    save_all_chats(username, all_chats)

    context = rag.query_context(question=last_user, course_id=chat.get("course_id"))
    lesson_params = _get_lesson_ai_params(lesson_id)

    def event_stream():
        full_reply = ""
        last_text  = ""
        for cumulative in ai_engine.stream_ai_response(
            messages=chat["messages"],
            context=context,
            teaching_style=chat.get("tone", "Professional Tutor"),
            mode=chat.get("mode", "direct"),
            custom_prompt=lesson_params["custom_prompt"],
            feedback_history=lesson_params["feedback_history"],
        ):
            delta     = cumulative[len(last_text):]
            last_text = cumulative
            full_reply += delta
            if delta:
                yield f"data: {json.dumps({'delta': delta})}\n\n"

        reload = load_all_chats(username)
        append_message(username, reload, chat_id, "assistant", full_reply)
        yield f"data: {json.dumps({'done': True})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")
# ── PATCH /chats/{chat_id}/settings
class UpdateSettingsRequest(BaseModel):
    mode: Optional[str] = None
    tone: Optional[str] = None


@router.patch("/{chat_id}/settings")
def update_settings(
    chat_id: str,
    body: UpdateSettingsRequest,
    current_user: dict = Depends(get_current_user),
):
    username  = current_user["username"]
    all_chats = load_all_chats(username)

    if chat_id not in all_chats:
        raise HTTPException(status_code=404, detail="Chat not found")

    if body.mode is not None:
        all_chats[chat_id]["mode"] = body.mode
    if body.tone is not None:
        all_chats[chat_id]["tone"] = body.tone

    save_all_chats(username, all_chats)
    return {"message": "Settings updated"}