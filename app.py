import streamlit as st
import ollama
import json
import os
from datetime import datetime
from PyPDF2 import PdfReader

HISTORY_FILE = "all_chats.json"


# --- Helper Functions ---
def load_all_chats():
    """Loads all chat history from the JSON file."""
    if os.path.exists(HISTORY_FILE):
        with open(HISTORY_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


def save_all_chats(all_chats):
    """Saves the current state of all chats to the JSON file."""
    with open(HISTORY_FILE, "w", encoding="utf-8") as f:
        json.dump(all_chats, f, ensure_ascii=False, indent=4)


def get_pdf_text(pdf_docs):
    """Extracts text content from uploaded PDF files."""
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

# --- SIDEBAR (Left Menu) ---
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

    # 2. PDF Upload Area (Visible only if a chat is selected)
    if st.session_state.current_chat_id:
        st.subheader("📄 Upload Study Notes")
        uploaded_pdfs = st.file_uploader("Select PDF files", accept_multiple_files=True, type="pdf")
        if st.button("Process Notes", use_container_width=True):
            if uploaded_pdfs:
                with st.spinner("Processing..."):
                    extracted_text = get_pdf_text(uploaded_pdfs)
                    all_chats[st.session_state.current_chat_id]["pdf_context"] = extracted_text
                    save_all_chats(all_chats)
                    st.success("Notes added successfully!")
            else:
                st.warning("No file selected.")

    st.divider()

    # 3. Chat History List and Single Delete
    st.subheader("Recent Conversations")

    chat_ids = list(all_chats.keys())
    for chat_id in reversed(chat_ids):
        # Two columns for Select and Delete buttons
        col1, col2 = st.columns([0.8, 0.2])

        with col1:
            if st.button(all_chats[chat_id]["title"], key=f"select_{chat_id}", use_container_width=True):
                st.session_state.current_chat_id = chat_id
                st.rerun()

        with col2:
            if st.button("🗑️", key=f"delete_{chat_id}", help="Delete chat"):
                del all_chats[chat_id]
                save_all_chats(all_chats)
                # Clear screen if the deleted chat is the current one
                if st.session_state.current_chat_id == chat_id:
                    st.session_state.current_chat_id = None
                st.rerun()

    # 4. Global Delete Button (At the bottom)
    if all_chats:
        st.divider()
        if st.button("🚫 Clear All History", use_container_width=True, type="primary"):
            all_chats = {}
            save_all_chats(all_chats)
            st.session_state.current_chat_id = None
            st.rerun()

# --- MAIN SCREEN (Chat Interface) ---
if st.session_state.current_chat_id:
    current_chat = all_chats[st.session_state.current_chat_id]
    st.title(f"📍 {current_chat['title']}")

    # Info box if PDF context exists
    if current_chat.get("pdf_context"):
        st.info("💡 This chat contains specific study notes. I will answer based on the provided content.")

    # Render Messages
    for msg in current_chat["messages"]:
        with st.chat_message(msg["role"]):
            st.markdown(msg["content"])

    # Chat Input
    if prompt := st.chat_input("Ask your learning assistant something..."):
        # Add user message
        current_chat["messages"].append({"role": "user", "content": prompt})
        with st.chat_message("user"):
            st.markdown(prompt)

        # AI Response
        with st.chat_message("assistant"):
            # RAG: Inject PDF context into system prompt if available
            pdf_info = current_chat.get("pdf_context", "")
            system_instruction = "You are a professional learning assistant and tutor."
            if pdf_info:
                system_instruction += f"\n\nBase your answers on the following document content provided by the user:\n{pdf_info}"

            # API Call (gpt-oss:120b-cloud)
            response = ollama.chat(model='gpt-oss:120b-cloud', messages=[
                {'role': 'system', 'content': system_instruction},
                *current_chat["messages"]
            ])

            answer = response['message']['content']
            st.markdown(answer)
            current_chat["messages"].append({"role": "assistant", "content": answer})

            # Update chat title based on the first question
            if current_chat["title"] == "New Chat":
                current_chat["title"] = prompt[:25] + "..."

            save_all_chats(all_chats)
else:
    st.markdown(
        "### Welcome! \nStart a **New Chat** from the sidebar or continue your previous conversations.")