import streamlit as st
from dotenv import load_dotenv

from chat_manager import load_all_chats
from ui_components import (
    render_sidebar,
    render_chat_screen,
    render_starter_dashboard,
    render_auth_screen,
    render_teacher_dashboard
)
load_dotenv()

st.set_page_config(
    page_title="Learning Assistant",
    page_icon="🎓",
    layout="wide",
    initial_sidebar_state="expanded",
)

if "logged_in" not in st.session_state:
    st.session_state.logged_in = False

if "current_user" not in st.session_state:
    st.session_state.current_user = None

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
    st.session_state.source_filter = None

if "pending_starter_message" not in st.session_state:
    st.session_state.pending_starter_message = False

if "selected_course_id" not in st.session_state:
    st.session_state.selected_course_id = None

if not st.session_state.logged_in or not st.session_state.current_user:
    render_auth_screen()
else:
    username = st.session_state.current_user["username"]
    role = st.session_state.current_user["role"]
    all_chats = load_all_chats(username)

    render_sidebar(all_chats)

    if role == "teacher":
        render_teacher_dashboard()
    else:
        if st.session_state.current_chat_id:
            render_chat_screen(all_chats)
        else:
            render_starter_dashboard(all_chats)