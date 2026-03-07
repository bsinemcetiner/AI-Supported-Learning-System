import json
import os
from datetime import datetime
import streamlit as st

HISTORY_FILE = "all_chats.json"

def load_all_chats():
    if os.path.exists(HISTORY_FILE):
        with open(HISTORY_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}

def save_all_chats(all_chats):
    with open(HISTORY_FILE, "w", encoding="utf-8") as f:
        json.dump(all_chats, f, ensure_ascii=False, indent=4)

def create_new_chat(all_chats):
    new_id = datetime.now().strftime("%Y%m%d_%H%M%S")
    st.session_state.current_chat_id = new_id
    all_chats[new_id] = {"title": "New Chat", "messages": [], "pdf_context": ""}
    save_all_chats(all_chats)
    return new_id