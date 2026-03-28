import json
import os
from datetime import datetime
from typing import Optional

CHAT_DIR = "chat_histories"


def _ensure_chat_dir():
    if not os.path.exists(CHAT_DIR):
        os.makedirs(CHAT_DIR)


def _get_user_chat_file(username: str) -> str:
    _ensure_chat_dir()
    safe_username = username.replace(" ", "_").lower()
    return os.path.join(CHAT_DIR, f"{safe_username}_chats.json")


def _normalize_chat(chat: dict) -> dict:
    if "title" not in chat:
        chat["title"] = "New Chat"
    if "messages" not in chat:
        chat["messages"] = []
    if "course_id" not in chat:
        chat["course_id"] = None
    if "uploaded_sources" not in chat:
        chat["uploaded_sources"] = []
    if "mode" not in chat:
        chat["mode"] = "direct"
    if "tone" not in chat:
        chat["tone"] = "Professional Tutor"
    if "pdf_context" not in chat:
        chat["pdf_context"] = ""
        if "lesson_id" not in chat:
            chat["lesson_id"] = None
    return chat


def load_all_chats(username: str):
    file_path = _get_user_chat_file(username)
    if os.path.exists(file_path):
        with open(file_path, "r", encoding="utf-8") as f:
            all_chats = json.load(f)
        return {cid: _normalize_chat(cdata) for cid, cdata in all_chats.items()}
    return {}


def save_all_chats(username: str, all_chats: dict):
    normalized = {cid: _normalize_chat(cdata) for cid, cdata in all_chats.items()}
    file_path = _get_user_chat_file(username)
    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(normalized, f, ensure_ascii=False, indent=4)

def create_new_chat(
            username: str,
            all_chats: dict,
            course_id: Optional[str] = None,
            lesson_id: Optional[str] = None,
            title: str = "New Chat",
            mode: str = "direct",
            tone: str = "Professional Tutor",
    ):
    new_id = datetime.now().strftime("%Y%m%d_%H%M%S")
    all_chats[new_id] = {
        "title": title,
        "messages": [],
        "course_id": course_id,
        "uploaded_sources": [],
        "mode": mode,
        "tone": tone,
        "pdf_context": "",
        "lesson_id": lesson_id,
    }
    save_all_chats(username, all_chats)
    return new_id


def delete_chat(username: str, all_chats: dict, chat_id: str):
    if chat_id not in all_chats:
        return False, "Chat not found."
    del all_chats[chat_id]
    save_all_chats(username, all_chats)
    return True, "Chat deleted successfully."


def rename_chat(username: str, all_chats: dict, chat_id: str, new_title: str):
    if chat_id not in all_chats:
        return False, "Chat not found."
    clean_title = new_title.strip()
    if not clean_title:
        return False, "Chat title cannot be empty."
    all_chats[chat_id]["title"] = clean_title
    save_all_chats(username, all_chats)
    return True, "Chat renamed successfully."


def append_message(username: str, all_chats: dict, chat_id: str, role: str, content: str):
    if chat_id not in all_chats:
        return False, "Chat not found."
    if role not in ["user", "assistant", "system"]:
        return False, "Invalid role."
    all_chats[chat_id]["messages"].append({"role": role, "content": content})
    save_all_chats(username, all_chats)
    return True, "Message appended successfully."


def update_chat_settings(
    username: str,
    all_chats: dict,
    chat_id: str,
    course_id: Optional[str] = None,
    lesson_id: Optional[str] = None,
    mode: Optional[str] = None,
    tone: Optional[str] = None,
):
    if chat_id not in all_chats:
        return False, "Chat not found."
    if course_id is not None:
        all_chats[chat_id]["course_id"] = course_id
    if mode is not None:
        all_chats[chat_id]["mode"] = mode
    if tone is not None:
        all_chats[chat_id]["tone"] = tone
        if lesson_id is not None:
            all_chats[chat_id]["lesson_id"] = lesson_id
    save_all_chats(username, all_chats)
    return True, "Chat settings updated successfully."