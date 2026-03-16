from typing import Optional

import streamlit as st
from pypdf import PdfReader

import ai_engine
from auth_manager import signup_user, login_user
from chat_manager import save_all_chats, create_new_chat
from course_manager import (
    create_course,
    add_material_to_course,
    get_teacher_courses,
    get_all_courses,
    get_course_materials,
    delete_material_from_course,
)
from rag_manager import RAGManager


# ──────────────────────────────────────────────────────────────────────────────
# WARM ORANGE THEME CSS
# ──────────────────────────────────────────────────────────────────────────────
PASTEL_CSS = """
<style>
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,600;1,9..144,400&display=swap');

:root {
    --bg:          #FDF8F2;
    --bg2:         #F7F0E6;
    --bg3:         #EFE6D8;
    --card:        #FFFFFF;
    --line:        #E8DDD0;
    --line2:       #D9CCBA;

    --text:        #1A1208;
    --text-mid:    #5C4D3A;
    --text-soft:   #9C8B78;
    --text-muted:  #C4B5A0;

    --orange:      #E8510A;
    --orange2:     #FF6B2B;
    --orange-lt:   #FFF0E8;
    --orange-md:   #FFD4BE;
    --orange-gl:   rgba(232,81,10,0.10);

    --teal:        #0A8A7A;
    --teal-lt:     #E6F5F3;

    --r-sm: 8px;
    --r-md: 14px;
    --r-lg: 22px;
}

html, body, .stApp, [class*="css"] {
    font-family: 'Plus Jakarta Sans', sans-serif !important;
    background: var(--bg) !important;
    color: var(--text) !important;
}

html, body {
    color-scheme: light !important;
}

body, p, span, div, li, label, input, textarea, button {
    color: var(--text) !important;
}

.stApp {
    background: var(--bg) !important;
}

.main .block-container {
    max-width: 860px;
    padding: 2.5rem 2rem 4rem !important;
}

h1 {
    font-family: 'Fraunces', serif !important;
    font-size: 2rem !important;
    font-weight: 600 !important;
    color: var(--text) !important;
    letter-spacing: -0.03em !important;
}

h2, h3 {
    font-family: 'Fraunces', serif !important;
    color: var(--text-mid) !important;
    font-weight: 600 !important;
}

[data-testid="stSidebar"] {
    background: var(--card) !important;
    border-right: 1.5px solid var(--line) !important;
}

[data-testid="stSidebar"] .block-container {
    padding: 1.5rem 1rem !important;
}

.stButton > button {
    background: var(--orange) !important;
    color: #ffffff !important;
    border: none !important;
    border-radius: var(--r-md) !important;
    font-family: 'Plus Jakarta Sans', sans-serif !important;
    font-weight: 600 !important;
    font-size: 0.88rem !important;
    padding: 0.55rem 1.1rem !important;
    transition: all 0.18s ease !important;
    box-shadow: 0 3px 14px rgba(232,81,10,0.28) !important;
}

.stButton > button:hover {
    background: var(--orange2) !important;
    box-shadow: 0 6px 22px rgba(232,81,10,0.38) !important;
    transform: translateY(-1px) !important;
}

.stButton > button:active {
    transform: translateY(0) !important;
}

[data-testid="stSidebar"] .stButton > button {
    background: var(--bg2) !important;
    color: var(--text-mid) !important;
    box-shadow: none !important;
    border: 1.5px solid var(--line) !important;
}

[data-testid="stSidebar"] .stButton > button:hover {
    background: var(--orange-lt) !important;
    border-color: var(--orange-md) !important;
    color: var(--orange) !important;
    transform: none !important;
    box-shadow: none !important;
}

.stTextInput,
.stTextArea,
.stSelectbox {
    background: transparent !important;
    box-shadow: none !important;
}

.stTextInput > div,
.stTextArea > div {
    background: transparent !important;
    border: none !important;
    box-shadow: none !important;
}

.stTextInput > div > div,
.stTextArea > div > div {
    background: var(--card) !important;
    border: 1.5px solid var(--line) !important;
    border-radius: var(--r-md) !important;
    box-shadow: none !important;
}

.stTextInput > div > div:focus-within,
.stTextArea > div > div:focus-within {
    border-color: var(--orange) !important;
    box-shadow: 0 0 0 3px var(--orange-gl) !important;
}

.stTextInput > div > div > input,
.stTextArea > div > div > textarea {
    background: transparent !important;
    border: none !important;
    outline: none !important;
    box-shadow: none !important;
    color: var(--text) !important;
    font-family: 'Plus Jakarta Sans', sans-serif !important;
    font-size: 0.9rem !important;
    caret-color: var(--text) !important;
}

.stTextInput > div > div > input:focus,
.stTextArea > div > div > textarea:focus {
    border: none !important;
    outline: none !important;
    box-shadow: none !important;
}

.stTextInput > div > div > input::placeholder,
.stTextArea > div > div > textarea::placeholder {
    color: var(--text-muted) !important;
    opacity: 1 !important;
}

[data-testid="stSidebar"] .stTextInput,
[data-testid="stSidebar"] .stTextInput * {
    box-shadow: none !important;
}

.stSelectbox > div,
.stSelectbox > div > div {
    background: transparent !important;
    box-shadow: none !important;
    border: none !important;
}

.stSelectbox div[data-baseweb="select"] {
    background: #FFFFFF !important;
    border: 1.5px solid #E8DDD0 !important;
    border-radius: 14px !important;
    box-shadow: none !important;
    min-height: 52px !important;
}

.stSelectbox div[data-baseweb="select"]:focus-within {
    border-color: #E8510A !important;
    box-shadow: 0 0 0 3px rgba(232,81,10,0.10) !important;
}

.stSelectbox div[data-baseweb="select"],
.stSelectbox div[data-baseweb="select"] > div,
.stSelectbox div[data-baseweb="select"] > div > div,
.stSelectbox div[data-baseweb="select"] span,
.stSelectbox div[data-baseweb="select"] input,
.stSelectbox div[data-baseweb="select"] p {
    background: #FFFFFF !important;
    color: #1A1208 !important;
    caret-color: #1A1208 !important;
}

.stSelectbox div[data-baseweb="select"] input {
    border: none !important;
    outline: none !important;
    box-shadow: none !important;
}

.stSelectbox div[data-baseweb="select"] svg {
    fill: #9C8B78 !important;
    color: #9C8B78 !important;
}

div[data-baseweb="popover"] {
    background: transparent !important;
}

div[data-baseweb="popover"] > div {
    background: #FFFFFF !important;
    border: 1.5px solid #E8DDD0 !important;
    border-radius: 22px !important;
    box-shadow: 0 8px 24px rgba(0,0,0,0.08) !important;
    overflow: hidden !important;
}

div[data-baseweb="popover"] ul,
div[data-baseweb="popover"] ol,
div[data-baseweb="popover"] li,
div[data-baseweb="popover"] li > div,
div[data-baseweb="popover"] [role="listbox"],
div[data-baseweb="popover"] [role="option"],
div[data-baseweb="popover"] [role="option"] > div,
div[data-baseweb="popover"] span,
div[data-baseweb="popover"] p {
    background: #FFFFFF !important;
    color: #1A1208 !important;
}

div[data-baseweb="popover"] [role="option"]:hover,
div[data-baseweb="popover"] li:hover,
div[data-baseweb="popover"] li:hover > div {
    background: #FFF0E8 !important;
    color: #E8510A !important;
}

div[data-baseweb="popover"] [aria-selected="true"],
div[data-baseweb="popover"] [aria-selected="true"] > div {
    background: #F7F0E6 !important;
    color: #1A1208 !important;
}

ul[role="listbox"],
li[role="option"],
div[role="option"] {
    background: #FFFFFF !important;
    color: #1A1208 !important;
}

.stTabs [data-baseweb="tab-list"] {
    background: var(--card) !important;
    border-radius: var(--r-md) !important;
    padding: 4px !important;
    border: 1.5px solid var(--line) !important;
    gap: 2px !important;
    box-shadow: 0 1px 6px rgba(0,0,0,0.04) !important;
}

.stTabs [data-baseweb="tab"] {
    background: transparent !important;
    border-radius: var(--r-sm) !important;
    color: var(--text-soft) !important;
    font-family: 'Plus Jakarta Sans', sans-serif !important;
    font-weight: 600 !important;
    font-size: 0.88rem !important;
    padding: 0.4rem 1.2rem !important;
    transition: all 0.18s !important;
}

.stTabs [aria-selected="true"] {
    background: var(--orange) !important;
    color: #ffffff !important;
    box-shadow: 0 3px 14px rgba(232,81,10,0.28) !important;
}

button[role="tab"] {
    color: var(--text-mid) !important;
}

button[role="tab"][aria-selected="true"] {
    color: #ffffff !important;
}

.stAlert {
    border-radius: var(--r-md) !important;
}

div.stSuccess {
    background: linear-gradient(135deg,#d1fae5,#a7f3d0) !important;
    color:#065f46 !important;
    border-left:3px solid #34d399 !important;
    border-radius: var(--r-md) !important;
}

div.stWarning {
    background: linear-gradient(135deg,#fef3c7,#fde68a) !important;
    color:#78350f !important;
    border-left:3px solid #fbbf24 !important;
    border-radius: var(--r-md) !important;
}

div.stInfo {
    background: var(--orange-lt) !important;
    color: var(--orange) !important;
    border-left:3px solid var(--orange) !important;
    border-radius: var(--r-md) !important;
}

div.stError {
    background: linear-gradient(135deg,#fee2e2,#fecaca) !important;
    color:#7f1d1d !important;
    border-left:3px solid #f87171 !important;
    border-radius: var(--r-md) !important;
}

.streamlit-expanderHeader {
    background: var(--bg2) !important;
    border: 1.5px solid var(--line) !important;
    border-radius: var(--r-sm) !important;
    color: var(--text-mid) !important;
    font-weight: 600 !important;
}

.streamlit-expanderContent {
    background: var(--card) !important;
    border: 1.5px solid var(--line) !important;
    border-top: none !important;
}

details {
    background: var(--card) !important;
    border: 1.5px solid var(--line) !important;
    border-radius: var(--r-md) !important;
}

[data-testid="stFileUploadDropzone"],
[data-testid="stFileUploader"] {
    background: var(--card) !important;
    border: 2px dashed var(--line2) !important;
    border-radius: var(--r-lg) !important;
    transition: all 0.2s !important;
}

[data-testid="stFileUploadDropzone"]:hover,
[data-testid="stFileUploader"]:hover {
    border-color: var(--orange) !important;
    background: var(--orange-lt) !important;
}

[data-testid="stChatMessage"] {
    background: var(--card) !important;
    border: 1.5px solid var(--line) !important;
    border-radius: var(--r-lg) !important;
    padding: 1rem 1.2rem !important;
    margin-bottom: 0.6rem !important;
    box-shadow: 0 2px 8px rgba(0,0,0,0.04) !important;
}

[data-testid="stChatMessage"]:has([data-testid="chatAvatarIcon-user"]) {
    background: var(--orange-lt) !important;
    border-color: var(--orange-md) !important;
}

[data-testid="stChatInputContainer"] {
    background: transparent !important;
}

[data-testid="stChatInputContainer"] > div {
    background: transparent !important;
}

[data-testid="stChatInput"] {
    border-radius: 22px !important;
    border: 1.5px solid #E8DDD0 !important;
    background: #FFFFFF !important;
    box-shadow: 0 2px 10px rgba(0,0,0,0.05) !important;
    transition: border-color 0.2s !important;
}

[data-testid="stChatInput"]:focus-within {
    border-color: #E8510A !important;
    box-shadow: 0 4px 18px rgba(232,81,10,0.14) !important;
}

[data-testid="stChatInput"] > div,
[data-testid="stChatInput"] > div > div,
[data-testid="stChatInput"] > div > div > div {
    background: #FFFFFF !important;
    border-radius: 22px !important;
}

[data-testid="stChatInput"] textarea,
[data-testid="stChatInput"] input,
[data-testid="stChatInput"] p {
    background: #FFFFFF !important;
    color: #1A1208 !important;
    caret-color: #1A1208 !important;
}

[data-testid="stChatInput"] textarea::placeholder,
[data-testid="stChatInput"] input::placeholder {
    color: #9C8B78 !important;
    opacity: 1 !important;
}

[data-testid="stChatInput"] button {
    background: transparent !important;
    border: none !important;
    box-shadow: none !important;
}

[data-testid="stChatInput"] button svg {
    fill: #9C8B78 !important;
    color: #9C8B78 !important;
}

.stTextInput label,
.stTextArea label,
.stSelectbox label,
.stFileUploader label,
label {
    font-weight: 600 !important;
    font-size: 0.82rem !important;
    color: var(--text-mid) !important;
    letter-spacing: 0.06em !important;
    text-transform: uppercase !important;
    font-family: 'Plus Jakarta Sans', sans-serif !important;
}

.stMarkdown p,
[data-testid="stMarkdownContainer"] p,
[data-testid="stMarkdownContainer"] * {
    color: var(--text) !important;
    line-height: 1.65 !important;
}

kbd {
    background: transparent !important;
    color: var(--text-soft) !important;
    border: none !important;
    box-shadow: none !important;
}

::-webkit-scrollbar {
    width: 5px;
}

::-webkit-scrollbar-track {
    background: transparent;
}

::-webkit-scrollbar-thumb {
    background: var(--orange-md);
    border-radius: 99px;
}

::-webkit-scrollbar-thumb:hover {
    background: var(--orange);
}

#MainMenu, footer {
    visibility: hidden;
}

header {
    visibility: visible !important;
    display: block !important;
    background: transparent !important;
}

[data-testid="stHeader"] {
    display: block !important;
    visibility: visible !important;
    background: transparent !important;
}

[data-testid="stToolbar"] {
    display: flex !important;
    visibility: visible !important;
    opacity: 1 !important;
}

button[kind="header"],
[data-testid="collapsedControl"] {
    display: flex !important;
    visibility: visible !important;
    opacity: 1 !important;
    z-index: 999999 !important;
}

button[kind="header"] svg,
[data-testid="collapsedControl"] svg {
    color: #1A1208 !important;
    fill: #1A1208 !important;
    opacity: 1 !important;
}

hr {
    border-color: var(--line) !important;
    opacity: 1 !important;
}

[data-testid="stHorizontalBlock"] {
    gap: 0.75rem !important;
}

.title-accent {
    display: inline-block;
    width: 36px;
    height: 3px;
    border-radius: 99px;
    background: var(--orange);
    margin-bottom: 1rem;
}
</style>
"""


def _generate_ai_reply(
    messages: list,
    context: str,
    teaching_style: str,
    mode: str = "direct",
) -> str:
    return ai_engine.generate_ai_response(
        messages=messages,
        context=context,
        teaching_style=teaching_style,
        mode=mode,
    )


def _stream_ai_reply(
    messages: list,
    context: str,
    teaching_style: str,
    mode: str = "direct",
):
    last_text = ""
    for cumulative in ai_engine.stream_ai_response(
        messages=messages,
        context=context,
        teaching_style=teaching_style,
        mode=mode,
    ):
        delta = cumulative[len(last_text):]
        last_text = cumulative
        if delta:
            yield delta


def _read_pdf_text(uploaded_file) -> str:
    try:
        uploaded_file.seek(0)
        reader = PdfReader(uploaded_file)
        texts = []
        for page in reader.pages:
            try:
                page_text = page.extract_text()
                if page_text:
                    texts.append(page_text)
            except Exception:
                continue
        full_text = "\n".join(texts).strip()
        return full_text
    except Exception as e:
        st.error(f"PDF okunamadı: {e}")
        return ""


def _logout():
    for key in ["logged_in", "current_user", "current_chat_id",
                "selected_course_id", "pending_starter_message", "starter_prompt"]:
        st.session_state[key] = (
            None if key in ("current_user", "current_chat_id", "selected_course_id")
            else False if key == "logged_in"
            else ""
        )
    # Upload state temizle
    for key in list(st.session_state.keys()):
        if key.startswith("upload_"):
            del st.session_state[key]
    st.rerun()


def _get_chat_course_label(course_id: Optional[str]) -> str:
    if not course_id:
        return "No course selected"
    course = get_all_courses().get(course_id)
    if not course:
        return "Unknown course"
    return f"{course['course_name']} — {course['teacher_username']}"


def _ensure_chat_metadata(current_chat: dict):
    defaults = {
        "course_id": st.session_state.get("selected_course_id"),
        "uploaded_sources": [],
        "mode": "direct",
        "tone": st.session_state.get("teaching_style", "Professional Tutor"),
    }
    for key, val in defaults.items():
        if key not in current_chat:
            current_chat[key] = val


def _create_chat_with_course(
    username: str, all_chats: dict, course_id: str, title: str = "New Chat"
):
    return create_new_chat(
        username=username,
        all_chats=all_chats,
        course_id=course_id,
        title=title,
        mode=st.session_state.get("teaching_mode", "direct"),
        tone=st.session_state.get("teaching_style", "Professional Tutor"),
    )


def _section_label(text: str):
    st.markdown(
        f"<p style='font-size:0.72rem;font-weight:700;color:#E8510A;"
        f"text-transform:uppercase;letter-spacing:1.2px;margin:0 0 0.4rem;"
        f"font-family:JetBrains Mono,monospace;'>{text}</p>",
        unsafe_allow_html=True,
    )


# ──────────────────────────────────────────────────────────────────────────────
# AUTH SCREEN
# ──────────────────────────────────────────────────────────────────────────────
def render_auth_screen():
    st.markdown(PASTEL_CSS, unsafe_allow_html=True)

    st.markdown("""
    <style>
    html, body, .stApp, [class*="css"],
    .stTextInput input, .stTextArea textarea,
    .stButton > button, label, p, span, div {
        font-family: 'Plus Jakarta Sans', sans-serif !important;
    }
    h1, h2, h3, .fraunces {
        font-family: 'Fraunces', serif !important;
    }

    section.main .block-container {
        max-width: 480px !important;
        padding: 0 1.5rem 4rem !important;
        margin: 0 auto !important;
    }

    .auth-hero {
        text-align: center;
        padding: 44px 0 28px;
    }
    .auth-badge {
        display: inline-flex; align-items: center; gap: 6px;
        background: #FFF0E8; border: 1px solid #FFD4BE;
        border-radius: 40px; padding: 4px 14px; margin-bottom: 16px;
        font-size: 9.5px; font-weight: 700;
        letter-spacing: .14em; text-transform: uppercase; color: #E8510A;
    }
    .auth-title {
        font-family: 'Fraunces', serif !important;
        font-size: 2.5rem; font-weight: 600; color: #1A1208;
        letter-spacing: -0.03em; line-height: 1.1; margin-bottom: 10px;
    }
    .auth-sub {
        font-size: 14px; color: #9C8B78;
        max-width: 340px; margin: 0 auto; line-height: 1.65;
    }

    .stTabs [data-baseweb="tab-list"] {
        background: transparent !important;
        border: none !important;
        border-bottom: 1.5px solid #E8DDD0 !important;
        border-radius: 0 !important;
        padding: 0 !important; gap: 0 !important;
        box-shadow: none !important;
    }
    .stTabs [data-baseweb="tab"] {
        background: transparent !important;
        border-radius: 0 !important;
        color: #9C8B78 !important;
        font-family: 'Plus Jakarta Sans', sans-serif !important;
        font-size: 14px !important; font-weight: 600 !important;
        padding: 8px 22px 10px !important;
        border-bottom: 2.5px solid transparent !important;
        margin-bottom: -1.5px !important;
        transition: color 0.15s !important;
    }
    .stTabs [aria-selected="true"] {
        background: transparent !important;
        color: #1A1208 !important;
        border-bottom: 2.5px solid #E8510A !important;
        box-shadow: none !important;
    }
    button[role="tab"] { color: #9C8B78 !important; font-family: 'Plus Jakarta Sans', sans-serif !important; }
    button[role="tab"][aria-selected="true"] { color: #1A1208 !important; }

    .auth-section-h {
        font-family: 'Fraunces', serif;
        font-size: 1.15rem; font-weight: 600; color: #1A1208;
        margin-bottom: 3px;
    }
    .auth-section-s {
        font-size: 13px; color: #9C8B78; margin-bottom: 20px; line-height: 1.5;
    }

    .role-label {
        font-size: 9.5px; font-weight: 700;
        letter-spacing: .14em; text-transform: uppercase;
        color: #9C8B78; display: block; margin-bottom: 9px;
    }

    div[data-testid="stHorizontalBlock"]
    div[data-testid="column"]:nth-of-type(1)
    .stButton > button {
        height: 90px !important;
        border-radius: 16px !important;
        font-family: 'Plus Jakarta Sans', sans-serif !important;
        font-size: 14px !important; font-weight: 700 !important;
        text-align: left !important;
        padding: 14px 16px !important;
        line-height: 1.5 !important;
        white-space: pre-wrap !important;
        background: #FDFAF7 !important;
        border: 1.5px solid #E8DDD0 !important;
        color: #1A1208 !important;
        box-shadow: 0 1px 6px rgba(0,0,0,0.04) !important;
        transition: all 0.15s !important;
    }
    div[data-testid="stHorizontalBlock"]
    div[data-testid="column"]:nth-of-type(1)
    .stButton > button:hover {
        border-color: #E8510A !important;
        background: #FFF0E8 !important;
        color: #E8510A !important;
        box-shadow: 0 3px 14px rgba(232,81,10,0.14) !important;
        transform: none !important;
    }

    div[data-testid="stHorizontalBlock"]
    div[data-testid="column"]:nth-of-type(2)
    .stButton > button {
        height: 90px !important;
        border-radius: 16px !important;
        font-family: 'Plus Jakarta Sans', sans-serif !important;
        font-size: 14px !important; font-weight: 700 !important;
        text-align: left !important;
        padding: 14px 16px !important;
        line-height: 1.5 !important;
        white-space: pre-wrap !important;
        background: #FDFAF7 !important;
        border: 1.5px solid #E8DDD0 !important;
        color: #1A1208 !important;
        box-shadow: 0 1px 6px rgba(0,0,0,0.04) !important;
        transition: all 0.15s !important;
    }
    div[data-testid="stHorizontalBlock"]
    div[data-testid="column"]:nth-of-type(2)
    .stButton > button:hover {
        border-color: #E8510A !important;
        background: #FFF0E8 !important;
        color: #E8510A !important;
        box-shadow: 0 3px 14px rgba(232,81,10,0.14) !important;
        transform: none !important;
    }

    .role-confirm {
        font-size: 11px; font-weight: 700;
        letter-spacing: .1em; text-transform: uppercase;
        color: #E8510A; margin: 10px 0 20px;
        display: flex; align-items: center; gap: 5px;
    }

    .stTextInput > div > div > input {
        background: #FDFAF7 !important;
        border: 1.5px solid #E8DDD0 !important;
        border-radius: 12px !important;
        font-size: 14px !important;
        font-family: 'Plus Jakarta Sans', sans-serif !important;
        padding: 11px 14px !important;
        color: #1A1208 !important;
        transition: all 0.15s !important;
    }
    .stTextInput > div > div > input:focus {
        border-color: #E8510A !important;
        background: #FFFFFF !important;
        box-shadow: 0 0 0 3px rgba(232,81,10,0.10) !important;
    }
    .stTextInput > div > div > input::placeholder { color: #C4B5A0 !important; }
    .stTextInput label {
        font-size: 10.5px !important; font-weight: 700 !important;
        letter-spacing: .12em !important; text-transform: uppercase !important;
        color: #9C8B78 !important;
        font-family: 'Plus Jakarta Sans', sans-serif !important;
    }

    .stButton > button[kind="primary"],
    .auth-cta .stButton > button {
        background: #E8510A !important;
        color: #FFFFFF !important;
        border: none !important;
        border-radius: 12px !important;
        font-family: 'Plus Jakarta Sans', sans-serif !important;
        font-size: 14.5px !important; font-weight: 700 !important;
        padding: 13px 28px !important;
        letter-spacing: 0.01em !important;
        box-shadow: 0 4px 18px rgba(232,81,10,0.28) !important;
        transition: all 0.16s !important;
    }
    .auth-cta .stButton > button:hover {
        background: #FF6B2B !important;
        box-shadow: 0 6px 26px rgba(232,81,10,0.38) !important;
        transform: translateY(-1px) !important;
    }

    .auth-hint {
        text-align: center; font-size: 12.5px;
        color: #C4B5A0; margin-top: 14px; line-height: 1.5;
    }
    </style>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,600;1,9..144,400&display=swap" rel="stylesheet">
    """, unsafe_allow_html=True)

    st.markdown("""
    <div class="auth-hero">
        <div class="auth-badge">✦ Welcome</div>
        <div class="auth-title">Learning Assistant</div>
        <p class="auth-sub">Sign in to continue, or create a new account as a student or teacher.</p>
    </div>
    """, unsafe_allow_html=True)

    _, col, _ = st.columns([1, 2.6, 1])
    with col:
        tab_login, tab_signup = st.tabs(["Login", "Sign Up"])

        with tab_login:
            st.markdown("<br>", unsafe_allow_html=True)
            st.markdown(
                "<div class='auth-section-h'>Welcome back 👋</div>"
                "<div class='auth-section-s'>Enter your credentials to continue learning.</div>",
                unsafe_allow_html=True,
            )
            username = st.text_input("Username", key="login_username", placeholder="your_username")
            password = st.text_input("Password", type="password", key="login_password", placeholder="••••••••")
            st.markdown("<br>", unsafe_allow_html=True)
            st.markdown("<div class='auth-cta'>", unsafe_allow_html=True)
            if st.button("Sign In →", use_container_width=True, key="login_btn"):
                success, message, user = login_user(username.strip(), password)
                if success:
                    st.session_state.logged_in = True
                    st.session_state.current_user = user
                    st.session_state.current_chat_id = None
                    st.success(message)
                    st.rerun()
                else:
                    st.error(message)
            st.markdown("</div>", unsafe_allow_html=True)
            st.markdown("<p class='auth-hint'>Don\'t have an account? Switch to Sign Up ↑</p>", unsafe_allow_html=True)

        with tab_signup:
            st.markdown("<br>", unsafe_allow_html=True)
            st.markdown(
                "<div class='auth-section-h'>Create your account</div>"
                "<div class='auth-section-s'>Join as a student or teacher and start learning.</div>",
                unsafe_allow_html=True,
            )

            if "signup_role_pick" not in st.session_state:
                st.session_state.signup_role_pick = "student"

            is_student = st.session_state.signup_role_pick == "student"
            is_teacher = st.session_state.signup_role_pick == "teacher"

            st.markdown(f"""
            <style>
            div[data-testid="stHorizontalBlock"]
            div[data-testid="column"]:nth-of-type(1) .stButton > button {{
                background: {"#FFF0E8" if is_student else "#FDFAF7"} !important;
                border-color: {"#E8510A" if is_student else "#E8DDD0"} !important;
                color: {"#E8510A" if is_student else "#1A1208"} !important;
                box-shadow: {"0 3px 14px rgba(232,81,10,0.15)" if is_student else "0 1px 6px rgba(0,0,0,0.04)"} !important;
            }}
            div[data-testid="stHorizontalBlock"]
            div[data-testid="column"]:nth-of-type(2) .stButton > button {{
                background: {"#FFF0E8" if is_teacher else "#FDFAF7"} !important;
                border-color: {"#E8510A" if is_teacher else "#E8DDD0"} !important;
                color: {"#E8510A" if is_teacher else "#1A1208"} !important;
                box-shadow: {"0 3px 14px rgba(232,81,10,0.15)" if is_teacher else "0 1px 6px rgba(0,0,0,0.04)"} !important;
            }}
            </style>
            """, unsafe_allow_html=True)

            st.markdown("<span class='role-label'>I am a...</span>", unsafe_allow_html=True)
            rc1, rc2 = st.columns(2, gap="small")
            with rc1:
                if st.button("🎓  Student\nLearn & explore", use_container_width=True, key="role_s_btn"):
                    st.session_state.signup_role_pick = "student"
                    st.rerun()
            with rc2:
                if st.button("🏫  Teacher\nCreate & teach", use_container_width=True, key="role_t_btn"):
                    st.session_state.signup_role_pick = "teacher"
                    st.rerun()

            role_display = "Student" if is_student else "Teacher"
            st.markdown(
                f"<div class='role-confirm'>✓ Continuing as {role_display}</div>",
                unsafe_allow_html=True,
            )

            full_name       = st.text_input("Full Name",  key="signup_full_name",  placeholder="Ada Lovelace")
            signup_username = st.text_input("Username",   key="signup_username",   placeholder="ada_loves_math")
            signup_password = st.text_input("Password",   type="password", key="signup_password", placeholder="••••••••")

            st.markdown("<br>", unsafe_allow_html=True)
            st.markdown("<div class='auth-cta'>", unsafe_allow_html=True)
            if st.button(f"Create {role_display} Account →", use_container_width=True, key="signup_btn"):
                if not full_name.strip() or not signup_username.strip() or not signup_password.strip():
                    st.warning("Please fill in all fields.")
                else:
                    success, message = signup_user(
                        full_name=full_name.strip(),
                        username=signup_username.strip(),
                        password=signup_password,
                        role=st.session_state.signup_role_pick,
                    )
                    if success:
                        st.success(f"✓ Account created as {role_display}! You can now log in.")
                    else:
                        st.error(message)
            st.markdown("</div>", unsafe_allow_html=True)


# ──────────────────────────────────────────────────────────────────────────────
# SIDEBAR
# ──────────────────────────────────────────────────────────────────────────────
def render_sidebar(all_chats: dict):
    user      = st.session_state.current_user
    username  = user["username"]
    role      = user["role"]
    full_name = user.get("full_name", username)

    with st.sidebar:
        st.markdown(
            f"""
            <div style="background:#FFF0E8;
                        border-radius:14px;padding:1rem 1.1rem;
                        margin-bottom:0.5rem;border:1px solid #FFD4BE;">
                <div style="font-family:'Fraunces',serif;font-size:1.05rem;
                            font-weight:600;color:#1A1208;">🎓 Learning Assistant</div>
                <div style="font-size:0.8rem;color:#9C8B78;margin-top:4px;">
                    {full_name} · <span style="color:#E8510A;font-weight:600;">{role}</span>
                </div>
            </div>
            """,
            unsafe_allow_html=True,
        )
        st.divider()

        if role == "student":
            _section_label("Teaching Preferences")

            st.session_state.teaching_style = st.selectbox(
                "Tone",
                ["Professional Tutor", "Friendly Mentor", "Simplified Explainer", "Encouraging Coach"],
                index=["Professional Tutor", "Friendly Mentor",
                       "Simplified Explainer", "Encouraging Coach"].index(
                    st.session_state.get("teaching_style", "Professional Tutor")
                ),
            )

            st.session_state.teaching_mode = st.selectbox(
                "Teaching Mode",
                ["direct", "hint_first", "socratic", "quiz_me"],
                format_func=lambda x: {
                    "direct":    "📖 Direct Explanation",
                    "hint_first":"💡 Hint First",
                    "socratic":  "🤔 Socratic Tutor",
                    "quiz_me":   "📝 Quiz Me",
                }[x],
                index=["direct", "hint_first", "socratic", "quiz_me"].index(
                    st.session_state.get("teaching_mode", "direct")
                ),
            )

            st.divider()
            _section_label("Your Chats")

            if st.button("➕  New Chat", use_container_width=True):
                st.session_state.current_chat_id = None
                st.rerun()

            chat_search = st.text_input(
                "",
                placeholder="🔍 Search chats...",
                key="chat_search_input",
                label_visibility="collapsed",
            )

            if not all_chats:
                st.markdown(
                    "<p style='color:#9C8B78;font-size:0.82rem;text-align:center;"
                    "padding:0.5rem 0;'>No chats yet — start learning! ✨</p>",
                    unsafe_allow_html=True,
                )
            else:
                search_query = chat_search.strip().lower()
                filtered_chats = {
                    cid: cdata
                    for cid, cdata in all_chats.items()
                    if not search_query or search_query in cdata.get("title", "").lower()
                }
                if not filtered_chats:
                    st.markdown(
                        "<p style='color:#9C8B78;font-size:0.82rem;text-align:center;"
                        "padding:0.5rem 0;'>No chats found.</p>",
                        unsafe_allow_html=True,
                    )
                else:
                    for chat_id, chat_data in sorted(filtered_chats.items(), reverse=True):
                        title = chat_data.get("title", "Untitled Chat")
                        label = "💬  " + (title if len(title) <= 26 else title[:26] + "…")
                        col_chat, col_del = st.columns([5, 1])
                        with col_chat:
                            if st.button(label, key=f"chat_btn_{chat_id}", use_container_width=True):
                                st.session_state.current_chat_id = chat_id
                                st.rerun()
                        with col_del:
                            if st.button("✕", key=f"del_btn_{chat_id}", use_container_width=True):
                                if st.session_state.get("current_chat_id") == chat_id:
                                    st.session_state.current_chat_id = None
                                del all_chats[chat_id]
                                save_all_chats(username, all_chats)
                                st.rerun()

        else:
            st.info("Teacher dashboard is active.")

        st.divider()
        if st.button("🚪  Logout", use_container_width=True):
            _logout()


# ──────────────────────────────────────────────────────────────────────────────
# TEACHER DASHBOARD  (UPLOAD FIX + DUPLICATE FILTER)
# ──────────────────────────────────────────────────────────────────────────────
def render_teacher_dashboard():
    st.markdown(PASTEL_CSS, unsafe_allow_html=True)
    st.markdown('<div class="title-accent"></div>', unsafe_allow_html=True)
    st.title("👩‍🏫 Teacher Dashboard")

    username = st.session_state.current_user["username"]
    rag = RAGManager()
    teacher_courses = get_teacher_courses(username)

    tab_create, tab_upload, tab_manage = st.tabs(
        ["✦ Create Course", "✦ Upload Material", "✦ My Courses"]
    )

    # ── CREATE COURSE ──────────────────────────────────────────────────────────
    with tab_create:
        st.markdown("<br>", unsafe_allow_html=True)
        st.markdown(
            "<p style='color:#5C4D3A;font-size:0.9rem;'>Give your course a clear, descriptive name.</p>",
            unsafe_allow_html=True,
        )
        new_course_name = st.text_input(
            "Course Name",
            key="teacher_new_course_name",
            placeholder="e.g. Introduction to Quantum Physics",
        )
        st.markdown("<br>", unsafe_allow_html=True)

        if st.button("Create Course →", key="create_course_btn", use_container_width=True):
            success, message = create_course(new_course_name, username)
            if success:
                st.success(f"✅ Course created: {message}")
                st.rerun()
            else:
                st.error(message)

    # ── UPLOAD MATERIAL ────────────────────────────────────────────────────────
    with tab_upload:
        st.markdown("<br>", unsafe_allow_html=True)

        if not teacher_courses:
            st.warning("⚠️ You need to create a course first.")
        else:
            course_options = {
                f"{c['course_name']} ({cid})": cid
                for cid, c in teacher_courses.items()
            }

            selected_label = st.selectbox(
                "Select Course",
                list(course_options.keys()),
                key="teacher_course_upload_select",
            )
            selected_course_id = course_options[selected_label]

            existing_materials = get_course_materials(selected_course_id)
            existing_filenames = {
                m.get("original_filename", "").strip().lower()
                for m in existing_materials
            }

            if existing_materials:
                st.markdown(
                    "<p style='font-size:0.8rem;font-weight:700;color:#9C8B78;"
                    "text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;'>"
                    "Already uploaded</p>",
                    unsafe_allow_html=True,
                )

                for material in existing_materials:
                    fname = material.get("original_filename", "Unknown")
                    st.markdown(
                        f"<div style='font-size:0.82rem;color:#E8510A;padding:3px 0;"
                        f"border-bottom:1px solid #F7F0E6;'>✓ {fname}</div>",
                        unsafe_allow_html=True,
                    )

                st.markdown("<br>", unsafe_allow_html=True)

            uploader_key = f"teacher_pdf_uploader_{selected_course_id}"

            uploaded_files = st.file_uploader(
                "Upload one or more PDF files",
                type=["pdf"],
                accept_multiple_files=True,
                key=uploader_key,
            )

            # her course için ayrı pending liste
            if uploaded_files is not None:
                st.session_state[f"pending_uploads_{selected_course_id}"] = uploaded_files

            pending_files = st.session_state.get(f"pending_uploads_{selected_course_id}", [])

            new_files = []
            skipped_name_duplicates = []

            for f in pending_files:
                if f.name.strip().lower() in existing_filenames:
                    skipped_name_duplicates.append(f)
                else:
                    new_files.append(f)

            if skipped_name_duplicates:
                st.markdown("<br>", unsafe_allow_html=True)
                for f in skipped_name_duplicates:
                    st.warning(f"⚠️ {f.name} was already uploaded before, so it will be skipped.")

            if new_files:
                st.markdown("<br>", unsafe_allow_html=True)
                st.markdown(
                    f"<p style='font-size:0.85rem;color:#5C4D3A;'>"
                    f"<b>{len(new_files)}</b> new file(s) ready to upload:</p>",
                    unsafe_allow_html=True,
                )
                for f in new_files:
                    st.markdown(
                        f"<div style='font-size:0.82rem;color:#1A1208;padding:3px 0;"
                        f"border-bottom:1px solid #F7F0E6;'>📄 {f.name}</div>",
                        unsafe_allow_html=True,
                    )

            st.markdown("<br>", unsafe_allow_html=True)

            btn_disabled = len(new_files) == 0

            if st.button(
                "⬆️ Process & Add Materials",
                use_container_width=True,
                key=f"process_upload_btn_{selected_course_id}",
                disabled=btn_disabled,
            ):
                added_count = 0
                skipped_count = 0
                failed_count = 0

                progress_bar = st.progress(0)
                status_box = st.empty()

                for i, pdf_file in enumerate(new_files):
                    status_box.markdown(
                        f"<p style='font-size:0.85rem;color:#5C4D3A;'>"
                        f"Processing <b>{pdf_file.name}</b>...</p>",
                        unsafe_allow_html=True,
                    )

                    raw_text = _read_pdf_text(pdf_file)

                    if not raw_text or len(raw_text.strip()) < 20:
                        st.error(
                            f"{pdf_file.name} could not be processed. "
                            f"This PDF may be scanned/image-based or contain no extractable text."
                        )
                        failed_count += 1
                        progress_bar.progress((i + 1) / len(new_files))
                        continue

                    add_ok, add_msg = add_material_to_course(
                        course_id=selected_course_id,
                        filename=pdf_file.name,
                        text_content=raw_text,
                    )

                    if not add_ok:
                        st.warning(f"{pdf_file.name}: {add_msg}")
                        skipped_count += 1
                        progress_bar.progress((i + 1) / len(new_files))
                        continue

                    try:
                        rag_result = rag.add_document(
                            text=raw_text,
                            source_name=pdf_file.name,
                            course_id=selected_course_id,
                            teacher_username=username,
                        )

                        if rag_result.get("skipped"):
                            st.warning(f"{pdf_file.name}: added to course list, but RAG skipped it.")
                        else:
                            st.success(
                                f"✅ {pdf_file.name} added successfully "
                                f"({rag_result.get('chunks', 0)} chunks)."
                            )

                        added_count += 1

                    except Exception as e:
                        st.error(f"{pdf_file.name}: RAG indexing failed → {e}")
                        failed_count += 1

                    progress_bar.progress((i + 1) / len(new_files))

                status_box.empty()
                progress_bar.empty()

                # process sonrası seçili dosyaları temizle
                if f"pending_uploads_{selected_course_id}" in st.session_state:
                    del st.session_state[f"pending_uploads_{selected_course_id}"]

                st.info(
                    f"Done — Added: **{added_count}** | "
                    f"Skipped: **{skipped_count + len(skipped_name_duplicates)}** | "
                    f"Failed: **{failed_count}**"
                )
                st.rerun()
    # ── MY COURSES ─────────────────────────────────────────────────────────────
    with tab_manage:
        st.markdown("<br>", unsafe_allow_html=True)

        if not teacher_courses:
            st.info("You haven't created any courses yet.")
        else:
            for course_id, course_data in teacher_courses.items():
                with st.expander(f"📚  {course_data['course_name']}  ·  {course_id}", expanded=False):
                    materials = get_course_materials(course_id)

                    col_a, col_b = st.columns(2)
                    col_a.markdown(
                        f"<p style='font-size:0.85rem;color:#5C4D3A;'><b>Teacher:</b> {course_data['teacher_username']}</p>",
                        unsafe_allow_html=True,
                    )
                    col_b.markdown(
                        f"<p style='font-size:0.85rem;color:#5C4D3A;'><b>Materials:</b> {len(materials)}</p>",
                        unsafe_allow_html=True,
                    )

                    if not materials:
                        st.caption("No materials uploaded yet.")
                    else:
                        for idx, material in enumerate(materials):
                            filename    = material.get("original_filename", "Unknown")
                            stored_path = material.get("stored_path", "")

                            row_a, row_b = st.columns([6, 1])

                            with row_a:
                                st.markdown(
                                    f"<div style='background:#FFF0E8;border-radius:8px;"
                                    f"padding:0.55rem 0.8rem;margin:0.25rem 0;font-size:0.85rem;"
                                    f"color:#1A1208;border:1px solid #FFD4BE;'>"
                                    f"📄 {filename}</div>",
                                    unsafe_allow_html=True,
                                )

                            with row_b:
                                if st.button(
                                    "🗑️",
                                    key=f"delete_material_{course_id}_{idx}",
                                    help=f"Delete {filename}",
                                    use_container_width=True,
                                ):
                                    ok, msg, removed_material = delete_material_from_course(
                                        course_id=course_id,
                                        stored_path=stored_path,
                                    )

                                    if not ok:
                                        st.error(msg)
                                    else:
                                        rag_delete = rag.delete_document(
                                            course_id=course_id,
                                            source_name=filename,
                                        )

                                        if rag_delete.get("found"):
                                            st.success(
                                                f"Deleted: {filename} "
                                                f"({rag_delete.get('deleted', 0)} chunks removed from DB)"
                                            )
                                        else:
                                            st.success(f"Deleted: {filename}")

                                        st.rerun()


# ──────────────────────────────────────────────────────────────────────────────
# COURSE IMAGE MAP
# ──────────────────────────────────────────────────────────────────────────────
COURSE_IMAGE_MAP = {
    "se115":               "assets/se115.png",
    "se116":               "assets/se115.png",
    "linear":              "assets/linearalgebra.png",
    "music and computers": "assets/musicandcomputers.jpg",
}


def _get_course_image(course_name: str) -> str:
    name_lower = course_name.lower()
    for key, path in COURSE_IMAGE_MAP.items():
        if key in name_lower:
            return path
    return None


# ──────────────────────────────────────────────────────────────────────────────
# STARTER DASHBOARD
# ──────────────────────────────────────────────────────────────────────────────
def render_starter_dashboard(all_chats: dict):
    st.markdown(PASTEL_CSS, unsafe_allow_html=True)
    st.markdown('<div class="title-accent"></div>', unsafe_allow_html=True)
    st.title("📘 Start Learning")
    st.markdown(
        "<p style='color:#9C8B78;margin-bottom:2rem;'>"
        "Pick a course and dive in — your AI tutor is ready.</p>",
        unsafe_allow_html=True,
    )

    all_courses = get_all_courses()
    if not all_courses:
        st.warning("No courses available yet. Ask a teacher to create a course.")
        return

    courses_list = list(all_courses.items())
    num_cols = 3
    rows = [courses_list[i:i + num_cols] for i in range(0, len(courses_list), num_cols)]

    for row in rows:
        cols = st.columns(num_cols)
        for col, (course_id, course_data) in zip(cols, row):
            with col:
                course_name = course_data.get("course_name", "Unnamed Course")
                teacher     = course_data.get("teacher_username", "")
                materials   = course_data.get("materials", [])
                img_path    = _get_course_image(course_name)

                st.markdown(
                    """
                    <div style="
                        background:#FFFFFF;
                        border:1.5px solid #E8DDD0;
                        border-radius:16px;
                        overflow:hidden;
                        box-shadow:0 2px 12px rgba(0,0,0,0.06);
                        transition:all 0.2s;
                        margin-bottom:0.5rem;
                    ">
                    """,
                    unsafe_allow_html=True,
                )

                if img_path:
                    try:
                        import base64, mimetypes
                        mime = mimetypes.guess_type(img_path)[0] or "image/jpeg"
                        with open(img_path, "rb") as _f:
                            b64 = base64.b64encode(_f.read()).decode()
                        st.markdown(
                            f"<div style='height:160px;overflow:hidden;border-radius:0;'>"
                            f"<img src='data:{mime};base64,{b64}' "
                            f"style='width:100%;height:160px;object-fit:cover;display:block;'/>"
                            f"</div>",
                            unsafe_allow_html=True,
                        )
                    except Exception:
                        st.markdown(
                            "<div style='height:160px;background:#FFF0E8;'></div>",
                            unsafe_allow_html=True,
                        )
                else:
                    st.markdown(
                        "<div style='height:160px;background:linear-gradient(135deg,#FFF0E8,#FFD4BE);"
                        "display:flex;align-items:center;justify-content:center;"
                        "font-size:2.5rem;'>📚</div>",
                        unsafe_allow_html=True,
                    )

                if materials:
                    shown = materials[-3:]
                    extra = len(materials) - len(shown)
                    mat_names = "".join(
                        f"<div style='font-size:0.75rem;color:#9C8B78;padding:0.15rem 0;"
                        f"border-bottom:1px solid #F7F0E6;'>"
                        f"📄 {m.get('original_filename', 'Unknown')}</div>"
                        for m in shown
                    )
                    if extra > 0:
                        mat_names += (
                            f"<div style='font-size:0.72rem;color:#E8510A;"
                            f"padding:0.2rem 0;font-weight:600;'>+ {extra} more</div>"
                        )
                else:
                    mat_names = "<div style='font-size:0.75rem;color:#C4B5A0;'>No materials yet</div>"

                st.markdown(
                    f"""
                    <div style="padding:0.8rem 1rem 0.6rem;">
                        <div style="font-size:1rem;font-weight:700;color:#1A1208;
                                    margin-bottom:0.15rem;">{course_name}</div>
                        <div style="font-size:0.78rem;color:#9C8B78;
                                    margin-bottom:0.6rem;">👤 {teacher}</div>
                        <div style="margin-bottom:0.5rem;">{mat_names}</div>
                    </div>
                    """,
                    unsafe_allow_html=True,
                )

                st.markdown("</div>", unsafe_allow_html=True)

                if st.button("▶  Start", key=f"start_{course_id}", use_container_width=True):
                    username = st.session_state.current_user["username"]
                    new_chat_id = _create_chat_with_course(
                        username=username,
                        all_chats=all_chats,
                        course_id=course_id,
                        title="New Chat",
                    )
                    st.session_state.current_chat_id = new_chat_id
                    st.session_state.pending_starter_message = False
                    st.session_state.starter_prompt = ""
                    st.rerun()

        if len(row) < num_cols:
            for empty_col in cols[len(row):]:
                with empty_col:
                    st.empty()


# ──────────────────────────────────────────────────────────────────────────────
# CHAT SCREEN
# ──────────────────────────────────────────────────────────────────────────────
def render_chat_screen(all_chats: dict):
    st.markdown(PASTEL_CSS, unsafe_allow_html=True)

    current_chat_id = st.session_state.current_chat_id
    username        = st.session_state.current_user["username"]

    if current_chat_id not in all_chats:
        st.error("Selected chat could not be found.")
        return

    current_chat = all_chats[current_chat_id]
    _ensure_chat_metadata(current_chat)

    rag          = RAGManager()
    course_id    = current_chat.get("course_id")
    course_label = _get_chat_course_label(course_id)
    tone         = current_chat.get("tone", "Professional Tutor")
    mode         = current_chat.get("mode", "direct")

    top_col1, top_col2 = st.columns([5, 1])
    with top_col1:
        st.markdown('<div class="title-accent"></div>', unsafe_allow_html=True)
        st.title("💬 Learning Chat")
        st.markdown(
            f"<p style='color:#9C8B78;font-size:0.85rem;margin-top:-0.5rem;'>"
            f"📚 {course_label} &nbsp;·&nbsp; "
            f"<span style='color:#E8510A;font-weight:600;'>{mode}</span>"
            f" &nbsp;·&nbsp; {tone}</p>",
            unsafe_allow_html=True,
        )
    with top_col2:
        st.markdown("<br><br>", unsafe_allow_html=True)
        if st.button("← Back", use_container_width=True):
            st.session_state.current_chat_id = None
            st.rerun()

    st.divider()

    if st.session_state.get("pending_starter_message") and st.session_state.get("starter_prompt"):
        first_prompt = st.session_state.starter_prompt.strip()
        if first_prompt:
            current_chat["messages"].append({"role": "user", "content": first_prompt})
            context = rag.query_context(question=first_prompt, course_id=course_id)
            try:
                reply = _generate_ai_reply(
                    messages=current_chat["messages"],
                    context=context,
                    teaching_style=tone,
                    mode=mode,
                )
            except Exception as e:
                reply = f"An error occurred: {e}"
            current_chat["messages"].append({"role": "assistant", "content": reply})
            if current_chat["title"] == "New Chat":
                current_chat["title"] = first_prompt[:40]
            save_all_chats(username, all_chats)
        st.session_state.pending_starter_message = False
        st.session_state.starter_prompt = ""
        st.rerun()

    if not current_chat["messages"]:
        st.markdown(
            """
            <div style="text-align:center;padding:3rem 1rem;color:#9C8B78;">
                <div style="font-size:2.5rem;margin-bottom:0.5rem;">✨</div>
                <p style="font-size:1rem;font-weight:600;color:#5C4D3A;">
                    Your conversation starts here
                </p>
                <p style="font-size:0.85rem;">
                    Ask anything about the course materials below.
                </p>
            </div>
            """,
            unsafe_allow_html=True,
        )

    for msg in current_chat["messages"]:
        with st.chat_message(msg["role"]):
            st.markdown(msg["content"])

    messages = current_chat["messages"]
    has_exchange = (
        len(messages) >= 2
        and messages[-1]["role"] == "assistant"
        and messages[-2]["role"] == "user"
    )
    if has_exchange:
        col_regen, col_spacer = st.columns([1, 4])
        with col_regen:
            if st.button("🔄 Regenerate", key="regenerate_btn", use_container_width=True):
                last_user_msg = messages[-2]["content"]
                current_chat["messages"] = messages[:-1]
                context = rag.query_context(question=last_user_msg, course_id=course_id)
                with st.chat_message("assistant"):
                    try:
                        new_reply = st.write_stream(
                            _stream_ai_reply(
                                messages=current_chat["messages"],
                                context=context,
                                teaching_style=tone,
                                mode=mode,
                            )
                        )
                    except Exception as e:
                        new_reply = f"An error occurred: {e}"
                        st.markdown(new_reply)
                current_chat["messages"].append({"role": "assistant", "content": new_reply})
                save_all_chats(username, all_chats)
                st.rerun()

    user_input = st.chat_input("Ask something about this course…")

    if user_input:
        current_chat["messages"].append({"role": "user", "content": user_input})
        with st.chat_message("user"):
            st.markdown(user_input)

        with st.chat_message("assistant"):
            context = rag.query_context(question=user_input, course_id=course_id)
            try:
                reply = st.write_stream(
                    _stream_ai_reply(
                        messages=current_chat["messages"],
                        context=context,
                        teaching_style=tone,
                        mode=mode,
                    )
                )
            except Exception as e:
                reply = f"An error occurred: {e}"
                st.markdown(reply)
        current_chat["messages"].append({"role": "assistant", "content": reply})
        if current_chat["title"] == "New Chat":
            current_chat["title"] = user_input[:40]
        save_all_chats(username, all_chats)
        st.rerun()