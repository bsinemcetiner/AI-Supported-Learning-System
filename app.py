import streamlit as st
from chat_manager import load_all_chats
from ui_components import render_sidebar, render_chat_screen, render_starter_dashboard

st.set_page_config(page_title="AI Learning Assistant", layout="wide")

all_chats = load_all_chats()

# Session state initialization
if "current_chat_id" not in st.session_state:
    st.session_state.current_chat_id = None
if "teaching_style" not in st.session_state:
    st.session_state.teaching_style = "Professional Tutor"
if "last_image_data" not in st.session_state:
    st.session_state.last_image_data = None
if "starter_prompt" not in st.session_state:
    st.session_state.starter_prompt = ""

# Sidebar
render_sidebar(all_chats)

# Main area
if st.session_state.current_chat_id:
    render_chat_screen(all_chats)
else:
    render_starter_dashboard(all_chats)