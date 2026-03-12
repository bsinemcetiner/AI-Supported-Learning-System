import json
import os
from datetime import datetime
import streamlit as st

CHAT_DIR = "chat_histories"


def _ensure_chat_dir():
    if not os.path.exists(CHAT_DIR):
        os.makedirs(CHAT_DIR)


def _get_user_chat_file(username: str) -> str:
    _ensure_chat_dir()
    safe_username = username.replace(" ", "_").lower()
    return os.path.join(CHAT_DIR, f"{safe_username}_chats.json")


def load_all_chats(username: str):
    file_path = _get_user_chat_file(username)
    if os.path.exists(file_path):
        with open(file_path, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


def save_all_chats(username: str, all_chats: dict):
    file_path = _get_user_chat_file(username)
    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(all_chats, f, ensure_ascii=False, indent=4)


def create_new_chat(username: str, all_chats: dict):
    new_id = datetime.now().strftime("%Y%m%d_%H%M%S")
    st.session_state.current_chat_id = new_id

    all_chats[new_id] = {
        "title": "New Chat",
        "messages": [],
        "pdf_context": ""
    }

    save_all_chats(username, all_chats)
    return new_id