import streamlit as st
from chat_manager import load_all_chats
from ui_components import render_sidebar, render_chat_screen, render_starter_dashboard
from dotenv import load_dotenv
load_dotenv()

st.set_page_config(
    page_title="Learning Assistant",
    page_icon="🎓",
    layout="wide",
    initial_sidebar_state="expanded",
)

all_chats = load_all_chats()

# ── Session state ─────────────────────────────────────────────────────────────
if "current_chat_id" not in st.session_state:
    st.session_state.current_chat_id = None

if "teaching_style" not in st.session_state:
    st.session_state.teaching_style = "Professional Tutor"

if "last_image_data" not in st.session_state:
    st.session_state.last_image_data = None

if "starter_prompt" not in st.session_state:
    st.session_state.starter_prompt = ""

if "processed_files" not in st.session_state:
    st.session_state.processed_files = set()

if "source_filter" not in st.session_state:
    st.session_state.source_filter = None  # None = tüm PDF'lerden ara

# ── Routing ───────────────────────────────────────────────────────────────────
render_sidebar(all_chats)

if st.session_state.current_chat_id:
    render_chat_screen(all_chats)
else:
    render_starter_dashboard(all_chats)