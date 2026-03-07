import streamlit as st
import ollama
import json
import os
from datetime import datetime
from PyPDF2 import PdfReader

HISTORY_FILE = "all_chats.json"


# Helper Functions
def load_all_chats():
    if os.path.exists(HISTORY_FILE):
        with open(HISTORY_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


def save_all_chats(all_chats):
    with open(HISTORY_FILE, "w", encoding="utf-8") as f:
        json.dump(all_chats, f, ensure_ascii=False, indent=4)


def get_pdf_text(pdf_docs):
    text = ""
    for pdf in pdf_docs:
        pdf_reader = PdfReader(pdf)
        for page in pdf_reader.pages:
            text += page.extract_text()
    return text


# Page Configuration
st.set_page_config(page_title="AI Learning Assistant", layout="wide")
all_chats = load_all_chats()

if "current_chat_id" not in st.session_state:
    st.session_state.current_chat_id = None
if "teaching_style" not in st.session_state:
    st.session_state.teaching_style = "Professional Tutor"

# SIDEBAR
with st.sidebar:
    st.title("📚 Learning Assistant")

    # 1. New Chat Button
    if st.button("➕ Start New Chat", use_container_width=True):
        new_id = datetime.now().strftime("%Y%m%d_%H%M%S")
        st.session_state.current_chat_id = new_id
        all_chats[new_id] = {"title": "New Chat", "messages": [], "pdf_context": ""}
        save_all_chats(all_chats)
        st.rerun()

    st.divider()


    st.subheader("Recent Conversations")
    chat_ids = list(all_chats.keys())
    for chat_id in reversed(chat_ids):
        col_title, col_del = st.columns([0.8, 0.2])
        with col_title:
            if st.button(all_chats[chat_id]["title"], key=f"select_{chat_id}", use_container_width=True):
                st.session_state.current_chat_id = chat_id
                st.rerun()
        with col_del:

            if st.button("🗑️", key=f"del_{chat_id}", help="Delete this chat"):
                del all_chats[chat_id]
                save_all_chats(all_chats)
                if st.session_state.current_chat_id == chat_id:
                    st.session_state.current_chat_id = None
                st.rerun()

    if all_chats:
        st.divider()
        if st.button("🚫 Clear All History", use_container_width=True, type="primary"):
            all_chats = {}
            save_all_chats(all_chats)
            st.session_state.current_chat_id = None
            st.rerun()

# MAIN SCREEN
if st.session_state.current_chat_id:
    current_chat = all_chats[st.session_state.current_chat_id]
    st.title(f"📍 {current_chat['title']}")

    # Render Chat History
    for msg in current_chat["messages"]:
        with st.chat_message(msg["role"]):
            st.markdown(msg["content"])

    # --- ACTION BAR (Improved Layout) ---
    st.write("---")

    upload_col, style_col = st.columns([0.65, 0.35])

    with upload_col:

        uploaded_pdfs = st.file_uploader(
            "📁 Drag & drop study notes here",
            accept_multiple_files=True,
            type="pdf",
            key="pdf_uploader"
        )
        if uploaded_pdfs:
            with st.spinner("Processing notes..."):
                current_chat["pdf_context"] = get_pdf_text(uploaded_pdfs)
                save_all_chats(all_chats)
                st.toast("Notes processed!", icon="✅")

    with style_col:
        st.markdown("### 🎭 Tutor Style")
        st.session_state.teaching_style = st.selectbox(
            "Style Selector",
            ["Professional Tutor", "Funny YouTuber", "Deep Scientist", "Simplified (for kids)"],
            label_visibility="collapsed"
        )
        st.caption(f"Current mode: {st.session_state.teaching_style}")

    # CHAT INPUT
    if prompt := st.chat_input("Ask your learning assistant something..."):
        current_chat["messages"].append({"role": "user", "content": prompt})
        with st.chat_message("user"):
            st.markdown(prompt)

        with st.chat_message("assistant"):
            pdf_info = current_chat.get("pdf_context", "")

            style_instructions = {
                "Professional Tutor": "Be formal, structured, and use academic language.",
                "Funny YouTuber": "Use humor, energetic slang, and metaphors like a popular creator.",
                "Deep Scientist": "Provide high-level technical analysis and detailed breakdowns.",
                "Simplified (for kids)": "Use very simple words, fun metaphors, and a teacher-for-kids tone."
            }

            system_instruction = (
                f"You are an AI {st.session_state.teaching_style}. {style_instructions[st.session_state.teaching_style]} "
                "IMPORTANT: Always use LaTeX for math. Wrap inline math in $ and block math in $$. "
                "DO NOT use <br> tags. Keep responses structured and clear."
            )

            if pdf_info:
                system_instruction += f"\n\nContext from PDF:\n{pdf_info}"

            # 120B Cloud model power
            response = ollama.chat(model='gpt-oss:120b-cloud', messages=[
                {'role': 'system', 'content': system_instruction},
                *current_chat["messages"]
            ])

            raw_answer = response['message']['content']
            # Cleaning layer for LaTeX and HTML
            answer = raw_answer.replace('\\(', '$').replace('\\)', '$').replace('\\[', '$$').replace('\\]',
                                                                                                     '$$').replace(
                '<br>', ' ')

            st.markdown(answer)
            current_chat["messages"].append({"role": "assistant", "content": answer})

            if current_chat["title"] == "New Chat":
                current_chat["title"] = prompt[:25] + "..."
            save_all_chats(all_chats)
else:
    st.markdown("### Welcome! \nStart a **New Chat** to begin your learning journey.")