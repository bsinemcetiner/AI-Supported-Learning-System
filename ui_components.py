import streamlit as st
from course_manager import (
    create_course,
    add_material_to_course,
    get_teacher_courses,
    get_course_display_options,
    get_course_materials_text
)
from chat_manager import save_all_chats, create_new_chat
from file_processor import get_pdf_text, process_image
from ai_engine import stream_ai_response
from rag_manager import RAGManager
from tts_engine import generate_audio
from auth_manager import signup_user, login_user
GLOBAL_CSS = """
<style>
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&family=Fraunces:ital,wght@0,300;0,500;1,300;1,500&display=swap');

/* ───────────────── BASE ───────────────── */

html, body, .stApp {
    font-family: 'Plus Jakarta Sans', sans-serif;
    box-sizing: border-box;
    background: #FAF8F5;
    color: #1C1917 !important;
}

*, *::before, *::after {
    box-sizing: border-box;
}

/* Streamlit default chrome */
#MainMenu, footer, header { visibility: hidden; }
.stDeployButton { display: none; }
[data-testid="stToolbar"] { display: none; }

/* Global readable text */
body, p, span, label, strong, em, small {
    color: #1C1917;
}

/* Markdown/text output */
[data-testid="stMarkdownContainer"],
[data-testid="stMarkdownContainer"] p,
[data-testid="stMarkdownContainer"] span,
[data-testid="stMarkdownContainer"] div,
[data-testid="stMarkdownContainer"] li,
[data-testid="stMarkdownContainer"] strong,
[data-testid="stMarkdownContainer"] em {
    color: #1C1917 !important;
}

/* IMPORTANT: Do not override icon fonts */
.material-symbols-rounded,
.material-symbols-outlined,
.material-icons,
.material-icons-round,
.material-icons-outlined,
[class*="material-symbols"],
[class*="material-icons"] {
    font-family: inherit;
}

/* Fix icon font text issue for Streamlit internal icons */
i.material-icons,
span.material-symbols-rounded,
span.material-symbols-outlined,
span.material-icons,
span[data-testid="stIconMaterial"] {
    font-family: "Material Symbols Rounded", "Material Symbols Outlined", "Material Icons" !important;
    font-style: normal !important;
    font-weight: normal !important;
    line-height: 1 !important;
    letter-spacing: normal !important;
    text-transform: none !important;
    white-space: nowrap !important;
    word-wrap: normal !important;
    direction: ltr !important;
}

/* ───────────────── SIDEBAR ───────────────── */

[data-testid="stSidebar"] {
    background: #FFFFFF;
    border-right: 1.5px solid #EDE9E3;
    padding-top: 0 !important;
}

[data-testid="stSidebar"] * {
    color: inherit;
}

.sidebar-brand {
    padding: 28px 20px 20px 20px;
    border-bottom: 1px solid #EDE9E3;
    margin-bottom: 16px;
}

/* Sidebar buttons */
[data-testid="stSidebar"] .stButton > button {
    background: transparent;
    border: none;
    color: #6B6560;
    font-size: 13px;
    font-weight: 500;
    text-align: left;
    padding: 8px 12px;
    border-radius: 10px;
    transition: all 0.15s ease;
    width: 100%;
    box-shadow: none !important;
}

[data-testid="stSidebar"] .stButton > button:hover {
    background: #F5F1EC;
    color: #1C1917;
    transform: none;
    box-shadow: none !important;
}

/* Sidebar first button */
[data-testid="stSidebar"] .stButton:first-of-type > button {
    background: #FF8C69 !important;
    color: #FFFFFF !important;
    font-weight: 600 !important;
    font-size: 13.5px !important;
    border-radius: 12px !important;
    padding: 11px 18px !important;
    box-shadow: 0 4px 16px rgba(255, 120, 80, 0.32) !important;
    letter-spacing: 0.01em;
    margin-bottom: 8px;
}

[data-testid="stSidebar"] .stButton:first-of-type > button:hover {
    background: #FF7A55 !important;
    box-shadow: 0 6px 22px rgba(255, 120, 80, 0.42) !important;
}

/* ───────────────── TYPOGRAPHY ───────────────── */

h1, h2, h3 {
    font-family: 'Fraunces', serif !important;
    font-weight: 500 !important;
    color: #1C1917 !important;
    letter-spacing: -0.025em;
}

.section-label {
    font-size: 10.5px;
    font-weight: 700;
    letter-spacing: 0.11em;
    text-transform: uppercase;
    color: #78716C !important;
    display: block;
    margin-bottom: 10px;
}

/* ───────────────── BUTTONS ───────────────── */

.stButton > button {
    background: #FFFFFF;
    border: 1.5px solid #E5E0D8;
    color: #44403C !important;
    border-radius: 12px;
    font-size: 13.5px;
    font-weight: 600;
    padding: 11px 20px;
    transition: all 0.18s ease;
    box-shadow: 0 1px 4px rgba(0,0,0,0.05);
}

.stButton > button:hover {
    background: #FFF6F2;
    border-color: #FFC4B0;
    color: #1C1917 !important;
    box-shadow: 0 4px 16px rgba(255, 120, 80, 0.14);
}

.stButton > button[kind="primary"] {
    background: linear-gradient(135deg, #FF8C69 0%, #FF6B9D 100%) !important;
    color: #FFFFFF !important;
    border: none !important;
    font-weight: 700 !important;
    font-size: 15px !important;
    padding: 14px 28px !important;
    border-radius: 14px !important;
    box-shadow: 0 6px 22px rgba(255, 100, 130, 0.38) !important;
}

.stButton > button[kind="primary"]:hover {
    color: #FFFFFF !important;
    box-shadow: 0 10px 30px rgba(255, 100, 130, 0.5) !important;
}

/* ───────────────── INPUTS ───────────────── */

label,
.stTextInput label,
.stSelectbox label,
.stFileUploader label {
    color: #44403C !important;
    font-weight: 600 !important;
    opacity: 1 !important;
    visibility: visible !important;
}

.stTextInput input,
.stTextArea textarea {
    background: #FFFFFF !important;
    border: 1.5px solid #E5E0D8 !important;
    border-radius: 12px !important;
    font-size: 14px !important;
    color: #1C1917 !important;
    padding: 13px 18px !important;
    box-shadow: 0 1px 4px rgba(0,0,0,0.04) !important;
}

.stTextInput input::placeholder,
.stTextArea textarea::placeholder {
    color: #A8A29E !important;
    opacity: 1 !important;
}

/* ───────────────── SELECTBOX FIX ───────────────── */

[data-testid="stSelectbox"] > div > div,
[data-baseweb="select"] > div {
    background: #FFFFFF !important;
    border: 1.5px solid #E5E0D8 !important;
    border-radius: 12px !important;
    color: #1C1917 !important;
    box-shadow: 0 1px 4px rgba(0,0,0,0.04) !important;
}

[data-testid="stSelectbox"] * ,
[data-baseweb="select"] *,
[data-baseweb="select"] span,
[data-baseweb="select"] div {
    color: #1C1917 !important;
}

/* Opened dropdown / portal */
div[data-baseweb="popover"],
div[data-baseweb="popover"] > div,
div[data-baseweb="menu"],
div[data-baseweb="menu"] > div,
[data-baseweb="popover"] {
    background: #FFFFFF !important;
    color: #1C1917 !important;
    border-radius: 12px !important;
}

/* Dropdown panel */
div[data-baseweb="menu"],
div[data-baseweb="menu"] ul,
div[data-baseweb="popover"] ul,
div[role="listbox"],
ul[role="listbox"] {
    background: #FFFFFF !important;
    border: 1.5px solid #E5E0D8 !important;
    border-radius: 12px !important;
    box-shadow: 0 8px 24px rgba(0,0,0,0.10) !important;
    padding: 6px !important;
}

/* Options */
div[data-baseweb="menu"] li,
div[data-baseweb="menu"] ul li,
div[data-baseweb="menu"] [role="option"],
div[data-baseweb="menu"] [role="listitem"],
div[role="option"],
ul[role="listbox"] li {
    background: #FFFFFF !important;
    color: #1C1917 !important;
    border-radius: 8px !important;
    opacity: 1 !important;
}

/* Option text */
div[data-baseweb="menu"] li *,
div[data-baseweb="menu"] ul li *,
div[data-baseweb="menu"] [role="option"] *,
div[data-baseweb="menu"] [role="listitem"] *,
div[role="option"] *,
ul[role="listbox"] li *,
div[data-baseweb="popover"] *,
div[role="listbox"] * {
    color: #1C1917 !important;
    opacity: 1 !important;
}

/* Hover / selected */
div[data-baseweb="menu"] li:hover,
div[data-baseweb="menu"] ul li:hover,
div[data-baseweb="menu"] [role="option"]:hover,
div[data-baseweb="menu"] [aria-selected="true"],
div[role="option"]:hover,
div[role="option"][aria-selected="true"],
ul[role="listbox"] li:hover,
ul[role="listbox"] li[aria-selected="true"] {
    background: #FFF6F2 !important;
    color: #1C1917 !important;
}

div[data-baseweb="menu"] li:hover *,
div[data-baseweb="menu"] ul li:hover *,
div[data-baseweb="menu"] [role="option"]:hover *,
div[data-baseweb="menu"] [aria-selected="true"] *,
div[role="option"]:hover *,
div[role="option"][aria-selected="true"] *,
ul[role="listbox"] li:hover *,
ul[role="listbox"] li[aria-selected="true"] * {
    color: #1C1917 !important;
    opacity: 1 !important;
}

/* ───────────────── FILE UPLOADER FIX ───────────────── */

[data-testid="stFileUploader"] {
    background: #FFFFFF !important;
    border: 2px dashed #DDD8D0 !important;
    border-radius: 16px !important;
    padding: 10px !important;
    transition: all 0.2s ease !important;
}

[data-testid="stFileUploader"]:hover {
    border-color: #FF8C69 !important;
    background: #FFF9F7 !important;
}

/* Uploader inner dark container fix */
[data-testid="stFileUploader"] section,
[data-testid="stFileUploader"] div,
[data-testid="stFileUploader"] small,
[data-testid="stFileUploader"] span,
[data-testid="stFileUploader"] label,
[data-testid="stFileUploader"] p {
    color: #1C1917 !important;
    background: transparent !important;
}

/* Drag area specifically */
[data-testid="stFileUploaderDropzone"] {
    background: #FFFFFF !important;
    border: 2px dashed #DDD8D0 !important;
    border-radius: 16px !important;
}

[data-testid="stFileUploaderDropzone"] * {
    color: #1C1917 !important;
    background: transparent !important;
}

/* Browse files button */
[data-testid="stFileUploader"] button {
    background: linear-gradient(135deg, #FF8C69 0%, #FF6B9D 100%) !important;
    color: #FFFFFF !important;
    border: none !important;
    border-radius: 12px !important;
    font-weight: 700 !important;
}

[data-testid="stFileUploader"] button * {
    color: #FFFFFF !important;
    background: transparent !important;
}

/* ───────────────── CHAT ───────────────── */

[data-testid="stChatInput"] {
    border: 1.5px solid #E5E0D8 !important;
    border-radius: 16px !important;
    background: #FFFFFF !important;
    box-shadow: 0 2px 12px rgba(0,0,0,0.06) !important;
}

[data-testid="stChatInput"] * {
    color: #1C1917 !important;
}

[data-testid="stChatMessage"] {
    background: #FFFFFF;
    border: 1px solid #EDE9E3;
    border-radius: 16px;
    padding: 8px 12px;
    margin-bottom: 10px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.045);
}

[data-testid="stChatMessage"] [data-testid="stMarkdownContainer"] * {
    color: #1C1917 !important;
}

[data-testid="stChatMessageContent"] * {
    color: #1C1917 !important;
}

/* ───────────────── TABS ───────────────── */

button[role="tab"] {
    color: #44403C !important;
    font-weight: 600 !important;
}

button[role="tab"][aria-selected="true"] {
    color: #1C1917 !important;
}

/* ───────────────── EXPANDER ───────────────── */

details {
    background: #FFFFFF !important;
    border: 1px solid #EDE9E3 !important;
    border-radius: 14px !important;
    padding: 4px 8px !important;
}

summary, summary * {
    color: #1C1917 !important;
}

/* Hide raw material icon text if Streamlit injects label text */
summary span:has(> span[data-testid="stIconMaterial"]) {
    display: inline-flex;
    align-items: center;
}

/* ───────────────── ALERTS / STATUS ───────────────── */

[data-testid="stAlertContainer"] * {
    color: #1C1917 !important;
}

.stSpinner > div {
    border-top-color: #FF8C69 !important;
}

/* Toast */
[data-testid="stToast"] {
    background: #1C1917;
    color: #FAF8F5 !important;
    border-radius: 12px;
    font-size: 13px;
    font-weight: 600;
    box-shadow: 0 4px 20px rgba(0,0,0,0.18);
}

[data-testid="stToast"] * {
    color: #FAF8F5 !important;
}

/* ───────────────── CUSTOM COMPONENTS ───────────────── */

.hero-badge {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    background: #FFF0EB;
    border: 1px solid #FFCDB8;
    border-radius: 40px;
    padding: 6px 16px;
    margin-bottom: 24px;
}

.hero-badge span {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #D9521A !important;
}

.how-card {
    background: #FFFFFF;
    border: 1.5px solid #EDE9E3;
    border-radius: 20px;
    padding: 26px 30px;
    margin-bottom: 24px;
    box-shadow: 0 2px 16px rgba(0,0,0,0.045);
}

.step-row {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 9px 0;
    color: #57534E !important;
    font-size: 14px;
    font-weight: 500;
}

.step-row:not(:last-child) {
    border-bottom: 1px solid #F5F1EC;
}

.step-num {
    width: 30px;
    height: 30px;
    background: linear-gradient(135deg, #FFD4C2 0%, #FFBAD0 100%);
    color: #9A3412 !important;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: 700;
    flex-shrink: 0;
}

.quick-grid-btn > button {
    background: #FFFFFF !important;
    border: 1.5px solid #E5E0D8 !important;
    border-radius: 14px !important;
    font-size: 13.5px !important;
    font-weight: 600 !important;
    color: #44403C !important;
    padding: 15px 18px !important;
    text-align: left !important;
    box-shadow: 0 1px 6px rgba(0,0,0,0.05) !important;
    height: 58px !important;
}

.quick-grid-btn > button:hover {
    background: linear-gradient(135deg, #FFF0EB 0%, #FFF0F6 100%) !important;
    border-color: #FFC4B0 !important;
    color: #1C1917 !important;
    box-shadow: 0 6px 20px rgba(255, 120, 80, 0.16) !important;
}

.feedback-ok {
    font-size: 13px;
    color: #16A34A !important;
    font-weight: 600;
    padding: 6px 0;
    display: flex;
    align-items: center;
    gap: 6px;
}
</style>
"""
def inject_css():
    st.markdown(GLOBAL_CSS, unsafe_allow_html=True)


def get_current_username():
    return st.session_state.current_user["username"]


# ══════════════════════════════════════════════════════════════════════════════
# AUTH SCREEN
# ══════════════════════════════════════════════════════════════════════════════
def render_auth_screen():
    inject_css()

    st.markdown(
        """
        <div style="max-width:700px; margin:50px auto 20px auto; text-align:center;">
            <div class="hero-badge" style="display:inline-flex;">
                <span>✦ Welcome</span>
            </div>
            <h1 style="font-size:52px; margin-bottom:12px;">Learning Assistant</h1>
            <p style="color:#78716C; font-size:16px;">
                Sign in to continue learning, or create a new account as a student or teacher.
            </p>
        </div>
        """,
        unsafe_allow_html=True
    )

    tab1, tab2 = st.tabs(["Login", "Sign Up"])

    with tab1:
        if "login_role_selected" not in st.session_state:
            st.session_state.login_role_selected = None

        # ADIM 1: Rol seçim ekranı
        if st.session_state.login_role_selected is None:
            st.markdown(
                """
                <div style="text-align:center; padding:32px 0 24px 0;">
                    <p style="font-size:18px; font-weight:600; color:#1C1917; margin-bottom:8px;">
                        Who are you?
                    </p>
                    <p style="font-size:14px; color:#78716C;">
                        Select your role to continue
                    </p>
                </div>
                """,
                unsafe_allow_html=True
            )

            st.markdown("""
            <style>
            div[data-testid="column"]:nth-of-type(1) .stButton>button {
                height:120px!important; border-radius:20px!important;
                font-size:16px!important; font-weight:700!important;
                border:2px solid #E5E0D8!important;
            }
            div[data-testid="column"]:nth-of-type(1) .stButton>button:hover {
                background:linear-gradient(135deg,#FFF0EB,#FFF0F6)!important;
                border:2px solid #FF8C69!important;
                box-shadow:0 6px 24px rgba(255,120,80,.22)!important;
            }
            div[data-testid="column"]:nth-of-type(2) .stButton>button {
                height:120px!important; border-radius:20px!important;
                font-size:16px!important; font-weight:700!important;
                border:2px solid #E5E0D8!important;
            }
            div[data-testid="column"]:nth-of-type(2) .stButton>button:hover {
                background:linear-gradient(135deg,#EEF2FF,#F5F0FF)!important;
                border:2px solid #818CF8!important;
                box-shadow:0 6px 24px rgba(120,100,220,.22)!important;
            }
            </style>
            """, unsafe_allow_html=True)

            r1, r2 = st.columns(2, gap="medium")
            with r1:
                if st.button("🎓 Student\n\nLearn & explore", use_container_width=True, key="pick_student"):
                    st.session_state.login_role_selected = "student"
                    st.rerun()
            with r2:
                if st.button("🏫 Teacher\n\nCreate & teach", use_container_width=True, key="pick_teacher"):
                    st.session_state.login_role_selected = "teacher"
                    st.rerun()

        # ADIM 2: Giriş formu
        else:
            role = st.session_state.login_role_selected
            emoji = "🎓" if role == "student" else "🏫"
            color = "#FF8C69" if role == "student" else "#818CF8"
            label = "Student" if role == "student" else "Teacher"

            st.markdown(
                f"<div style=\"display:flex;align-items:center;gap:10px;margin-bottom:20px;\">"
                f"<span style=\"font-size:28px;\">{emoji}</span>"
                f"<div><div style=\"font-size:18px;font-weight:700;color:#1C1917;\">Login as {label}</div>"
                f"<div style=\"font-size:12px;color:{color};font-weight:600;\">Select a different role below</div></div>"
                f"</div>",
                unsafe_allow_html=True
            )

            login_username = st.text_input("Username", key="login_username")
            login_password = st.text_input("Password", type="password", key="login_password")

            if st.button("Login", type="primary", use_container_width=True):
                ok, msg, user_data = login_user(login_username.strip(), login_password)
                if ok:
                    actual_role = user_data.get("role", "student")
                    if actual_role != role:
                        role_tr = {"student": "Ogrenci", "teacher": "Ogretmen"}
                        st.error(
                            f"Bu hesap bir {role_tr[actual_role]} hesabidir. "
                            f"Lutfen dogru rol ile giris yapin."
                        )
                    else:
                        st.session_state.logged_in = True
                        st.session_state.current_user = user_data
                        st.session_state.current_chat_id = None
                        st.success(msg)
                        st.rerun()
                else:
                    st.error(msg)

            st.markdown("<div style=\"margin-top:12px;\"></div>", unsafe_allow_html=True)
            if st.button("← Change role", use_container_width=False, key="change_role_btn"):
                st.session_state.login_role_selected = None
                st.rerun()

    with tab2:
        st.markdown("### Sign Up")

        # Role seçimi — session_state ile tutulur
        if "signup_role_selected" not in st.session_state:
            st.session_state.signup_role_selected = "student"

        st.markdown(
            "<span class='section-label' style='margin-bottom:8px;display:block;'>I am a...</span>",
            unsafe_allow_html=True
        )

        role_col1, role_col2 = st.columns(2, gap="small")

        student_selected = st.session_state.signup_role_selected == "student"
        teacher_selected = st.session_state.signup_role_selected == "teacher"

        student_style = """
            background: linear-gradient(135deg,#FFF0EB 0%,#FFF0F6 100%) !important;
            border: 2px solid #FF8C69 !important;
            color: #1C1917 !important;
            box-shadow: 0 4px 18px rgba(255,120,80,0.18) !important;
        """ if student_selected else ""

        teacher_style = """
            background: linear-gradient(135deg,#EEF2FF 0%,#F5F0FF 100%) !important;
            border: 2px solid #818CF8 !important;
            color: #1C1917 !important;
            box-shadow: 0 4px 18px rgba(120,100,220,0.18) !important;
        """ if teacher_selected else ""

        st.markdown(f"""
        <style>
        div[data-testid="column"]:nth-of-type(1) .stButton > button {{
            height: 90px !important;
            border-radius: 16px !important;
            font-size: 15px !important;
            font-weight: 700 !important;
            {student_style}
        }}
        div[data-testid="column"]:nth-of-type(2) .stButton > button {{
            height: 90px !important;
            border-radius: 16px !important;
            font-size: 15px !important;
            font-weight: 700 !important;
            {teacher_style}
        }}
        </style>
        """, unsafe_allow_html=True)

        with role_col1:
            if st.button("🎓  Student\nLearn & explore", use_container_width=True, key="role_btn_student"):
                st.session_state.signup_role_selected = "student"
                st.rerun()

        with role_col2:
            if st.button("🏫  Teacher\nCreate & teach", use_container_width=True, key="role_btn_teacher"):
                st.session_state.signup_role_selected = "teacher"
                st.rerun()

        selected_role_label = "Student" if student_selected else "Teacher"
        selected_color = "#D9521A" if student_selected else "#4F46E5"
        st.markdown(
            f"<div style='font-size:12px; color:{selected_color}; font-weight:600; "
            f"margin-bottom:14px; margin-top:4px;'>✓ Continuing as {selected_role_label}</div>",
            unsafe_allow_html=True
        )

        full_name = st.text_input("Full Name", key="signup_full_name")
        signup_username = st.text_input("Username", key="signup_username")
        signup_password = st.text_input("Password", type="password", key="signup_password")

        if st.button("Create Account", type="primary", use_container_width=True):
            if not full_name.strip() or not signup_username.strip() or not signup_password.strip():
                st.warning("Please fill in all fields.")
            else:
                ok, msg = signup_user(
                    full_name=full_name.strip(),
                    username=signup_username.strip(),
                    password=signup_password,
                    role=st.session_state.signup_role_selected
                )
                if ok:
                    st.success(f"✓ Account created as {selected_role_label}! You can now log in.")
                else:
                    st.error(msg)


# ══════════════════════════════════════════════════════════════════════════════
# SIDEBAR
# ══════════════════════════════════════════════════════════════════════════════
def render_sidebar(all_chats):
    inject_css()

    current_user = st.session_state.current_user
    username = current_user["username"]
    full_name = current_user["full_name"]
    role = current_user["role"]

    if "editing_chat_id" not in st.session_state:
        st.session_state.editing_chat_id = None
    if "editing_chat_title" not in st.session_state:
        st.session_state.editing_chat_title = ""

    with st.sidebar:
        st.markdown(
            f"""
            <div class="sidebar-brand">
                <div style="font-family:'Fraunces',serif; font-size:20px; color:#1C1917;
                    font-weight:500; letter-spacing:-0.01em; line-height:1.2;">
                    🎓 Learning<br><em style="color:#FF8C69;">Assistant</em>
                </div>
                <div style="margin-top:14px; font-size:13px; color:#57534E;">
                    <strong>{full_name}</strong><br>
                    @{username}<br>
                    <span style="color:#FF8C69; font-weight:600;">{role.title()}</span>
                </div>
            </div>
            """,
            unsafe_allow_html=True
        )

        if st.button("＋  New Chat", use_container_width=True):
            create_new_chat(username, all_chats)
            st.session_state.last_image_data = None
            st.rerun()

        if st.button("↩ Logout", use_container_width=True):
            st.session_state.logged_in = False
            st.session_state.current_user = None
            st.session_state.current_chat_id = None
            st.session_state.last_image_data = None
            st.session_state.processed_files = set()
            st.session_state.pending_starter_message = False
            st.rerun()

        st.markdown(
            "<span class='section-label' style='padding:0 12px; margin-top:8px;'>Recent chats</span>",
            unsafe_allow_html=True
        )

        for chat_id in reversed(list(all_chats.keys())):
            title = all_chats[chat_id]["title"]
            short_title = title if len(title) <= 26 else title[:26] + "…"

            r1, r2 = st.columns([0.83, 0.17])
            with r1:
                if st.button(short_title, key=f"sel_{chat_id}", use_container_width=True):
                    st.session_state.current_chat_id = chat_id
                    st.rerun()
            with r2:
                with st.popover("⋯", use_container_width=True):
                    if st.button("🗑 Delete", key=f"del_{chat_id}", use_container_width=True):
                        del all_chats[chat_id]
                        save_all_chats(username, all_chats)
                        if st.session_state.current_chat_id == chat_id:
                            st.session_state.current_chat_id = None
                        st.rerun()


# ══════════════════════════════════════════════════════════════════════════════
# CHAT SCREEN
# ══════════════════════════════════════════════════════════════════════════════
def render_chat_screen(all_chats):

    inject_css()
    username = get_current_username()

    if st.session_state.current_chat_id not in all_chats:
        st.session_state.current_chat_id = None
        st.rerun()
        return

    current_chat = all_chats[st.session_state.current_chat_id]
    if current_chat.get("course_id"):
        st.caption(f"Selected course: {current_chat.get('course_id')}")
    course_id = current_chat.get("course_id")
    if course_id:
        current_chat["pdf_context"] = get_course_materials_text(course_id)

    c1, c2 = st.columns([0.12, 0.88])
    with c1:
        if st.button("← Back", use_container_width=True):
            st.session_state.current_chat_id = None
            st.rerun()
    with c2:
        st.markdown(
            f"<h1 style='font-size:26px; margin:0; padding-top:6px;'>{current_chat['title']}</h1>",
            unsafe_allow_html=True
        )

    st.divider()

    for i, msg in enumerate(current_chat["messages"]):
        with st.chat_message(msg["role"]):
            st.markdown(msg["content"])
            if msg["role"] == "assistant":
                msg_key = f"audio_{i}"
                if st.button("🔊  Dinle", key=f"tts_hist_{i}"):
                    with st.spinner("Ses hazırlanıyor…"):
                        audio_bytes = generate_audio(
                            msg["content"],
                            teaching_style=st.session_state.teaching_style
                        )
                    if audio_bytes:
                        st.session_state[msg_key] = audio_bytes
                    else:
                        st.warning("Ses üretilemedi.")
                if msg_key in st.session_state:
                    st.audio(st.session_state[msg_key], format="audio/mp3")

    st.write("")
    up_col, st_col = st.columns([0.65, 0.35])

    with up_col:
        if "processed_files" not in st.session_state:
            st.session_state.processed_files = set()

        uploaded_files = st.file_uploader(
            "Upload PDF or image",
            accept_multiple_files=True,
            type=["pdf", "jpg", "png", "jpeg"],
            key="chat_uploader"
        )

        if uploaded_files:
            rag = RAGManager()

            for pdf_file in [f for f in uploaded_files if f.type == "application/pdf"]:
                unique_pdf_key = f"{username}_{st.session_state.current_chat_id}_{pdf_file.name}"

                with st.spinner(f"Processing {pdf_file.name}…"):
                    pdf_text = get_pdf_text([pdf_file])

                    if unique_pdf_key not in st.session_state.processed_files:
                        rag.add_document(pdf_text, source_name=pdf_file.name)
                        st.session_state.processed_files.add(unique_pdf_key)

                    existing_context = current_chat.get("pdf_context", "")
                    new_block = f"\n\n--- {pdf_file.name} ---\n{pdf_text}"

                    if new_block not in existing_context:
                        current_chat["pdf_context"] = existing_context + new_block

                    st.toast(f"✓ {pdf_file.name} added")

            img_files = [f for f in uploaded_files if f.type in ["image/jpeg", "image/png"]]
            if img_files:
                st.session_state.last_image_data = process_image(img_files[-1])
                st.image(img_files[-1], width=220, caption="Ready for analysis")

            save_all_chats(username, all_chats)

    with st_col:
        st.markdown("<span class='section-label'>Tutor Style</span>", unsafe_allow_html=True)
        st.session_state.teaching_style = st.selectbox(
            "Style",
            ["Professional Tutor", "Funny YouTuber", "Simplified"],
            label_visibility="collapsed",
            key="chat_style_select"
        )

    # Starter dashboard'dan gelen ilk mesajı otomatik cevapla
    if st.session_state.get("pending_starter_message", False):
        last_msg = current_chat["messages"][-1] if current_chat["messages"] else None

        if last_msg and last_msg["role"] == "user":
            with st.chat_message("assistant"):
                ph = st.empty()
                full_resp = ""

                for chunk in stream_ai_response(
                        current_chat["messages"],
                        current_chat.get("pdf_context", ""),
                        st.session_state.teaching_style,
                        st.session_state.last_image_data
                ):
                    full_resp = chunk
                    ph.markdown(full_resp + "▌")

                ph.markdown(full_resp)

            current_chat["messages"].append({"role": "assistant", "content": full_resp})
            save_all_chats(username, all_chats)

        st.session_state.pending_starter_message = False
        st.rerun()
        return

    prompt = st.chat_input("Ask anything…")
    if prompt:
        current_chat["messages"].append({"role": "user", "content": prompt})

        with st.chat_message("user"):
            st.markdown(prompt)

        with st.chat_message("assistant"):
            ph = st.empty()
            full_resp = ""

            for chunk in stream_ai_response(
                current_chat["messages"],
                current_chat.get("pdf_context", ""),
                st.session_state.teaching_style,
                st.session_state.last_image_data
            ):
                full_resp = chunk
                ph.markdown(full_resp + "▌")

            ph.markdown(full_resp)

            if full_resp:
                msg_key = f"audio_{len(current_chat['messages'])}"
                if st.button("🔊  Dinle", key=f"tts_{len(current_chat['messages'])}"):
                    with st.spinner("Ses hazırlanıyor…"):
                        audio_bytes = generate_audio(
                            full_resp,
                            teaching_style=st.session_state.teaching_style
                        )
                    if audio_bytes:
                        st.session_state[msg_key] = audio_bytes
                    else:
                        st.warning("Ses üretilemedi. API key'i kontrol edin.")

                if msg_key in st.session_state:
                    st.audio(st.session_state[msg_key], format="audio/mp3")

        current_chat["messages"].append({"role": "assistant", "content": full_resp})

        if current_chat["title"] == "New Chat":
            current_chat["title"] = prompt.strip()[:25] + "…"
            save_all_chats(username, all_chats)
            st.rerun()

        save_all_chats(username, all_chats)
def render_teacher_dashboard():
    inject_css()
    username = get_current_username()

    st.markdown(
        """
        <div style="text-align:center; padding:40px 0 24px 0;">
            <div class="hero-badge" style="display:inline-flex;">
                <span>✦ Teacher Panel</span>
            </div>
            <h1 style="
                font-family:'Fraunces',serif;
                font-size:48px; font-weight:500;
                color:#1C1917; letter-spacing:-0.03em;
                line-height:1.08; margin:0 0 20px 0;">
                Manage your courses<br>
                <em style="color:#FF8C69; font-style:italic;">and materials</em>
            </h1>
            <p style="
                font-size:16px; color:#78716C;
                max-width:560px; margin:0 auto;
                line-height:1.65;">
                Create courses, upload PDF materials, and let students learn from your content.
            </p>
        </div>
        """,
        unsafe_allow_html=True
    )

    st.markdown("### Create New Course")
    course_name = st.text_input("Course name", placeholder="e.g. Calculus 1")

    if st.button("Create Course", type="primary", use_container_width=True):
        if not course_name.strip():
            st.warning("Please enter a course name.")
        else:
            ok, result = create_course(course_name.strip(), username)
            if ok:
                st.success(f"Course created: {course_name}")
                st.rerun()
            else:
                st.error(result)

    st.divider()

    st.markdown("### Your Courses")
    teacher_courses = get_teacher_courses(username)

    if not teacher_courses:
        st.info("You have not created any courses yet.")
        return

    for course_id, course_data in teacher_courses.items():
        with st.expander(f"{course_data['course_name']}"):
            st.write(f"**Teacher:** {course_data['teacher_username']}")
            st.write(f"**Materials:** {len(course_data.get('materials', []))}")

            uploaded_files = st.file_uploader(
                f"Upload PDFs for {course_data['course_name']}",
                type=["pdf"],
                accept_multiple_files=True,
                key=f"teacher_upload_{course_id}"
            )

            if uploaded_files:
                rag = RAGManager()
                for pdf_file in uploaded_files:
                    with st.spinner(f"Processing {pdf_file.name}..."):
                        raw_text = get_pdf_text([pdf_file])
                        rag.add_document(raw_text, source_name=pdf_file.name)
                        ok, msg = add_material_to_course(
                            course_id=course_id,
                            filename=pdf_file.name,
                            text_content=raw_text
                        )
                        if ok:
                            st.success(f"{pdf_file.name} added.")
                        else:
                            st.error(msg)

            materials = course_data.get("materials", [])
            if materials:
                st.markdown("**Uploaded Materials**")
                for material in materials:
                    st.markdown(f"- {material['original_filename']}")

# ══════════════════════════════════════════════════════════════════════════════
# STARTER DASHBOARD
# ══════════════════════════════════════════════════════════════════════════════
def render_starter_dashboard(all_chats):
    inject_css()
    username = get_current_username()

    if "starter_text_input_value" not in st.session_state:
        st.session_state.starter_text_input_value = ""
    if "starter_feedback" not in st.session_state:
        st.session_state.starter_feedback = ""

    st.markdown(
        """
        <div style="text-align:center; padding:60px 0 44px 0;">
            <div class="hero-badge" style="display:inline-flex;">
                <span>✦ AI-Powered Study Tool</span>
            </div>
            <h1 style="
                font-family:'Fraunces',serif;
                font-size:56px; font-weight:500;
                color:#1C1917; letter-spacing:-0.03em;
                line-height:1.08; margin:0 0 20px 0;">
                Learn anything,<br>
                <em style="color:#FF8C69; font-style:italic;">your way.</em>
            </h1>
            <p style="
                font-size:16.5px; color:#78716C;
                max-width:460px; margin:0 auto;
                font-weight:400; line-height:1.65;
                font-family:'Plus Jakarta Sans',sans-serif;">
                Upload your notes or photos, pick a teaching style,<br>
                and let AI explain it the way you actually understand.
            </p>
        </div>
        """,
        unsafe_allow_html=True
    )

    st.markdown(
        """
        <div class="how-card">
            <span class="section-label">How it works</span>
            <div class="step-row">
                <div class="step-num">1</div>
                <span>Upload a <strong>PDF or image</strong> from your notes</span>
            </div>
            <div class="step-row">
                <div class="step-num">2</div>
                <span>Choose a <strong>tutor style</strong> that clicks for you</span>
            </div>
            <div class="step-row">
                <div class="step-num">3</div>
                <span>Pick a quick prompt or <strong>write your own question</strong></span>
            </div>
            <div class="step-row">
                <div class="step-num">4</div>
                <span>Hit <strong style="color:#FF8C69;">Start Learning</strong> and go 🚀</span>
            </div>
        </div>
        """,
        unsafe_allow_html=True
    )

    col_up, col_style = st.columns([0.62, 0.38], gap="medium")

    with col_up:
        st.markdown("<span class='section-label'>Upload your notes</span>", unsafe_allow_html=True)
        starter_files = st.file_uploader(
            "Upload",
            accept_multiple_files=True,
            type=["pdf", "jpg", "png", "jpeg"],
            key="starter_file_uploader",
            label_visibility="collapsed"
        )

    with col_style:
        st.markdown("<span class='section-label'>Tutor style</span>", unsafe_allow_html=True)
        st.session_state.teaching_style = st.selectbox(
            "Style",
            ["Professional Tutor", "Funny YouTuber", "Deep Scientist", "Simplified (for kids)"],
            label_visibility="collapsed",
            key="starter_style_select"
        )
    st.write("")
    st.markdown("<span class='section-label'>Select course</span>", unsafe_allow_html=True)

    course_options = get_course_display_options()

    if course_options:
        selected_label = st.selectbox(
            "Course",
            options=list(course_options.keys()),
            label_visibility="collapsed",
            key="student_course_select"
        )
        st.session_state.selected_course_id = course_options[selected_label]
    else:
        st.session_state.selected_course_id = None
        st.warning("No courses have been added by teachers yet.")
    st.write("")
    st.markdown("<span class='section-label'>Quick start</span>", unsafe_allow_html=True)

    q1, q2 = st.columns(2, gap="small")
    q3, q4 = st.columns(2, gap="small")

    with q1:
        st.markdown("<div class='quick-grid-btn'>", unsafe_allow_html=True)
        if st.button("📄  Summarize document", use_container_width=True):
            st.session_state.starter_text_input_value = "Can you summarize this document for me?"
            st.session_state.starter_feedback = "Prompt ready — scroll down and hit Start!"
        st.markdown("</div>", unsafe_allow_html=True)

    with q2:
        st.markdown("<div class='quick-grid-btn'>", unsafe_allow_html=True)
        if st.button("🖼️  Explain this image", use_container_width=True):
            st.session_state.starter_text_input_value = "Can you explain this image step by step?"
            st.session_state.starter_feedback = "Prompt ready — scroll down and hit Start!"
        st.markdown("</div>", unsafe_allow_html=True)

    with q3:
        st.markdown("<div class='quick-grid-btn'>", unsafe_allow_html=True)
        if st.button("🧠  Create quiz questions", use_container_width=True):
            st.session_state.starter_text_input_value = "Can you create study questions from these notes?"
            st.session_state.starter_feedback = "Prompt ready — scroll down and hit Start!"
        st.markdown("</div>", unsafe_allow_html=True)

    with q4:
        st.markdown("<div class='quick-grid-btn'>", unsafe_allow_html=True)
        if st.button("✦  Teach it simply", use_container_width=True):
            st.session_state.starter_text_input_value = "Can you explain this topic in a very simple way?"
            st.session_state.starter_feedback = "Prompt ready — scroll down and hit Start!"
        st.markdown("</div>", unsafe_allow_html=True)

    if st.session_state.starter_feedback:
        st.markdown(
            f"<div class='feedback-ok'>✓ {st.session_state.starter_feedback}</div>",
            unsafe_allow_html=True
        )

    st.write("")
    st.markdown("<span class='section-label'>Your question</span>", unsafe_allow_html=True)

    starter_input = st.text_input(
        "Question",
        placeholder="e.g. Explain this topic like I'm 15 years old…",
        key="starter_text_input_value",
        label_visibility="collapsed"
    )

    st.write("")

    if st.button("🚀  Start Learning", use_container_width=True, type="primary"):
        if not starter_input.strip() and not starter_files:
            st.warning("Please add a question or upload a file first.")
            return

        new_chat_id = create_new_chat(username, all_chats)
        current_chat = all_chats[new_chat_id]
        selected_course_id = st.session_state.get("selected_course_id")

        if selected_course_id:
            current_chat["course_id"] = selected_course_id
            current_chat["pdf_context"] = get_course_materials_text(selected_course_id)
        else:
            current_chat["course_id"] = None
            current_chat["pdf_context"] = ""

        if starter_files:
            with st.spinner("Analysing your files…"):
                rag = RAGManager()
                pdf_files = [f for f in starter_files if f.type == "application/pdf"]
                img_files = [f for f in starter_files if f.type in ["image/jpeg", "image/png"]]

                if pdf_files:
                    if "processed_files" not in st.session_state:
                        st.session_state.processed_files = set()

                    all_pdf_text = []

                    for pdf_file in pdf_files:
                        unique_pdf_key = f"{username}_{new_chat_id}_{pdf_file.name}"
                        raw_text = get_pdf_text([pdf_file])

                        if unique_pdf_key not in st.session_state.processed_files:
                            rag.add_document(raw_text, source_name=pdf_file.name)
                            st.session_state.processed_files.add(unique_pdf_key)

                        all_pdf_text.append(f"\n\n--- {pdf_file.name} ---\n{raw_text}")

                    current_chat["pdf_context"] = "".join(all_pdf_text)

                if img_files:
                    st.session_state.last_image_data = process_image(img_files[-1])

        if starter_input.strip():
            current_chat["messages"].append({
                "role": "user",
                "content": starter_input.strip()
            })
            current_chat["title"] = starter_input.strip()[:25] + "…"
            st.session_state.pending_starter_message = True

        save_all_chats(username, all_chats)

        st.session_state.current_chat_id = new_chat_id
        st.session_state.starter_feedback = ""
        st.rerun()