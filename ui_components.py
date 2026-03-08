import streamlit as st
from chat_manager import save_all_chats, create_new_chat
from file_processor import get_pdf_text, process_image
from ai_engine import stream_ai_response
from rag_manager import RAGManager
from tts_engine import generate_audio


GLOBAL_CSS = """
<style>
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&family=Fraunces:ital,wght@0,300;0,500;1,300;1,500&display=swap');

*, html, body, [class*="css"] {
    font-family: 'Plus Jakarta Sans', sans-serif;
    box-sizing: border-box;
}

/* ── App background ── */
.stApp {
    background: #FAF8F5;
}

/* ── Hide Streamlit chrome ── */
#MainMenu, footer, header { visibility: hidden; }
.stDeployButton { display: none; }
[data-testid="stToolbar"] { display: none; }

/* ══════════════════════════════════
   SIDEBAR
══════════════════════════════════ */
[data-testid="stSidebar"] {
    background: #FFFFFF;
    border-right: 1.5px solid #EDE9E3;
    padding-top: 0 !important;
}

/* Sidebar brand */
.sidebar-brand {
    padding: 28px 20px 20px 20px;
    border-bottom: 1px solid #EDE9E3;
    margin-bottom: 16px;
}

/* All sidebar buttons */
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
    box-shadow: none !important;
    width: 100%;
}
[data-testid="stSidebar"] .stButton > button:hover {
    background: #F5F1EC;
    color: #1C1917;
    transform: none;
    box-shadow: none !important;
}

/* New Chat button — first button in sidebar */
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
    transform: translateY(-1px) !important;
}

/* ══════════════════════════════════
   TYPOGRAPHY
══════════════════════════════════ */
h1 {
    font-family: 'Fraunces', serif !important;
    font-weight: 500 !important;
    color: #1C1917 !important;
    letter-spacing: -0.025em;
    line-height: 1.1 !important;
}

/* ══════════════════════════════════
   BUTTONS (main area)
══════════════════════════════════ */
.stButton > button {
    background: #FFFFFF;
    border: 1.5px solid #E5E0D8;
    color: #44403C;
    border-radius: 12px;
    font-family: 'Plus Jakarta Sans', sans-serif;
    font-size: 13.5px;
    font-weight: 600;
    padding: 11px 20px;
    transition: all 0.18s ease;
    box-shadow: 0 1px 4px rgba(0,0,0,0.05);
}
.stButton > button:hover {
    background: #FFF6F2;
    border-color: #FFC4B0;
    box-shadow: 0 4px 16px rgba(255, 120, 80, 0.14);
    transform: translateY(-2px);
    color: #1C1917;
}
.stButton > button:active { transform: translateY(0); }

/* Primary button */
.stButton > button[kind="primary"] {
    background: linear-gradient(135deg, #FF8C69 0%, #FF6B9D 100%) !important;
    color: #FFFFFF !important;
    border: none !important;
    font-weight: 700 !important;
    font-size: 15px !important;
    padding: 14px 28px !important;
    border-radius: 14px !important;
    box-shadow: 0 6px 22px rgba(255, 100, 130, 0.38) !important;
    letter-spacing: 0.01em;
}
.stButton > button[kind="primary"]:hover {
    box-shadow: 0 10px 30px rgba(255, 100, 130, 0.5) !important;
    transform: translateY(-2px) !important;
}

/* ══════════════════════════════════
   INPUTS
══════════════════════════════════ */
[data-testid="stFileUploader"] {
    background: #FFFFFF;
    border: 2px dashed #DDD8D0;
    border-radius: 16px;
    padding: 10px;
    transition: all 0.2s ease;
}
[data-testid="stFileUploader"]:hover {
    border-color: #FF8C69;
    background: #FFF9F7;
}

[data-testid="stSelectbox"] > div > div {
    background: #FFFFFF;
    border: 1.5px solid #E5E0D8;
    border-radius: 12px;
    font-size: 13.5px;
    font-weight: 500;
    color: #44403C;
    box-shadow: 0 1px 4px rgba(0,0,0,0.04);
}

.stTextInput > div > div > input {
    background: #FFFFFF;
    border: 1.5px solid #E5E0D8;
    border-radius: 12px;
    font-family: 'Plus Jakarta Sans', sans-serif;
    font-size: 14px;
    font-weight: 400;
    color: #1C1917;
    padding: 13px 18px;
    box-shadow: 0 1px 4px rgba(0,0,0,0.04);
    transition: all 0.18s ease;
}
.stTextInput > div > div > input:focus {
    border-color: #FF8C69;
    box-shadow: 0 0 0 3px rgba(255, 140, 105, 0.12);
}
.stTextInput > div > div > input::placeholder {
    color: #C5BDB4;
    font-weight: 400;
}

[data-testid="stChatInput"] {
    border: 1.5px solid #E5E0D8 !important;
    border-radius: 16px !important;
    background: #FFFFFF !important;
    box-shadow: 0 2px 12px rgba(0,0,0,0.06) !important;
    font-family: 'Plus Jakarta Sans', sans-serif;
}

/* ══════════════════════════════════
   CHAT MESSAGES
══════════════════════════════════ */
[data-testid="stChatMessage"] {
    background: #FFFFFF;
    border: 1px solid #EDE9E3;
    border-radius: 16px;
    padding: 6px 10px;
    margin-bottom: 10px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.045);
}

/* ══════════════════════════════════
   MISC
══════════════════════════════════ */
hr {
    border: none;
    border-top: 1px solid #EDE9E3;
    margin: 20px 0;
}

.stSpinner > div { border-top-color: #FF8C69 !important; }

[data-testid="stToast"] {
    background: #1C1917;
    color: #FAF8F5;
    border-radius: 12px;
    font-size: 13px;
    font-weight: 600;
    box-shadow: 0 4px 20px rgba(0,0,0,0.18);
}

/* ══════════════════════════════════
   DASHBOARD CUSTOM COMPONENTS
══════════════════════════════════ */
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
    color: #D9521A;
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
    color: #57534E;
    font-size: 14px;
    font-weight: 500;
}
.step-row:not(:last-child) {
    border-bottom: 1px solid #F5F1EC;
}
.step-num {
    width: 30px; height: 30px;
    background: linear-gradient(135deg, #FFD4C2 0%, #FFBAD0 100%);
    color: #9A3412;
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 12px; font-weight: 700; flex-shrink: 0;
}

.section-label {
    font-size: 10.5px;
    font-weight: 700;
    letter-spacing: 0.11em;
    text-transform: uppercase;
    color: #A8A29E;
    display: block;
    margin-bottom: 10px;
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
    transition: all 0.18s ease !important;
    box-shadow: 0 1px 6px rgba(0,0,0,0.05) !important;
    height: 58px !important;
}
.quick-grid-btn > button:hover {
    background: linear-gradient(135deg, #FFF0EB 0%, #FFF0F6 100%) !important;
    border-color: #FFC4B0 !important;
    box-shadow: 0 6px 20px rgba(255, 120, 80, 0.16) !important;
    transform: translateY(-3px) !important;
    color: #1C1917 !important;
}

.feedback-ok {
    font-size: 13px; color: #16A34A;
    font-weight: 600; padding: 6px 0;
    display: flex; align-items: center; gap: 6px;
}
</style>
"""


def inject_css():
    st.markdown(GLOBAL_CSS, unsafe_allow_html=True)


# ══════════════════════════════════════════════════════════════════════════════
# SIDEBAR
# ══════════════════════════════════════════════════════════════════════════════
def render_sidebar(all_chats):
    inject_css()
    if "editing_chat_id" not in st.session_state:
        st.session_state.editing_chat_id = None
    if "editing_chat_title" not in st.session_state:
        st.session_state.editing_chat_title = ""

    with st.sidebar:
        st.markdown(
            """
            <div class="sidebar-brand">
                <div style="font-family:'Fraunces',serif; font-size:20px; color:#1C1917;
                    font-weight:500; letter-spacing:-0.01em; line-height:1.2;">
                    🎓 Learning<br><em style="color:#FF8C69;">Assistant</em>
                </div>
            </div>
            """,
            unsafe_allow_html=True
        )

        if st.button("＋  New Chat", use_container_width=True):
            create_new_chat(all_chats)
            st.session_state.last_image_data = None
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
                        save_all_chats(all_chats)
                        if st.session_state.current_chat_id == chat_id:
                            st.session_state.current_chat_id = None
                        st.rerun()


# ══════════════════════════════════════════════════════════════════════════════
# CHAT SCREEN
# ══════════════════════════════════════════════════════════════════════════════
def render_chat_screen(all_chats):
    inject_css()
    current_chat = all_chats[st.session_state.current_chat_id]

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
            # Sadece assistant mesajlarına Dinle butonu ekle
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
            "Upload PDF or image", accept_multiple_files=True,
            type=["pdf", "jpg", "png", "jpeg"], key="chat_uploader"
        )
        if uploaded_files:
            rag = RAGManager()
            for pdf_file in [f for f in uploaded_files if f.type == "application/pdf"]:
                if pdf_file.name not in st.session_state.processed_files:
                    with st.spinner(f"Processing {pdf_file.name}…"):
                        rag.add_document(get_pdf_text([pdf_file]), source_name=pdf_file.name)
                        st.session_state.processed_files.add(pdf_file.name)
                        st.toast(f"✓ {pdf_file.name} added")
            img_files = [f for f in uploaded_files if f.type in ["image/jpeg", "image/png"]]
            if img_files:
                st.session_state.last_image_data = process_image(img_files[-1])
                st.image(img_files[-1], width=220, caption="Ready for analysis")
            save_all_chats(all_chats)

    with st_col:
        st.markdown("<span class='section-label'>Tutor Style</span>", unsafe_allow_html=True)
        st.session_state.teaching_style = st.selectbox(
            "Style", ["Professional Tutor", "Funny YouTuber", "Simplified"],
            label_visibility="collapsed"
        )

    prompt = st.chat_input("Ask anything…")
    if prompt:
        current_chat["messages"].append({"role": "user", "content": prompt})
        with st.chat_message("user"):
            st.markdown(prompt)
        with st.chat_message("assistant"):
            ph = st.empty()
            full_resp = ""
            for chunk in stream_ai_response(
                current_chat["messages"], None,
                st.session_state.teaching_style,
                st.session_state.last_image_data
            ):
                full_resp = chunk
                ph.markdown(full_resp + "▌")
            ph.markdown(full_resp)

            # ── 🔊 Dinle butonu ──
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
            save_all_chats(all_chats)
            st.rerun()
        save_all_chats(all_chats)


# ══════════════════════════════════════════════════════════════════════════════
# STARTER DASHBOARD
# ══════════════════════════════════════════════════════════════════════════════
def render_starter_dashboard(all_chats):
    inject_css()

    if "starter_text_input_value" not in st.session_state:
        st.session_state.starter_text_input_value = ""
    if "starter_feedback" not in st.session_state:
        st.session_state.starter_feedback = ""

    # ── Hero ──────────────────────────────────────────────────────────────────
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

    # ── How it works ──────────────────────────────────────────────────────────
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

    # ── Upload + Style ────────────────────────────────────────────────────────
    col_up, col_style = st.columns([0.62, 0.38], gap="medium")

    with col_up:
        st.markdown("<span class='section-label'>Upload your notes</span>", unsafe_allow_html=True)
        starter_files = st.file_uploader(
            "Upload", accept_multiple_files=True,
            type=["pdf", "jpg", "png", "jpeg"],
            key="starter_file_uploader", label_visibility="collapsed"
        )

    with col_style:
        st.markdown("<span class='section-label'>Tutor style</span>", unsafe_allow_html=True)
        st.session_state.teaching_style = st.selectbox(
            "Style",
            ["Professional Tutor", "Funny YouTuber", "Deep Scientist", "Simplified (for kids)"],
            label_visibility="collapsed", key="starter_style_select"
        )

    st.write("")

    # ── Quick prompts ─────────────────────────────────────────────────────────
    st.markdown("<span class='section-label'>Quick start</span>", unsafe_allow_html=True)

    q1, q2 = st.columns(2, gap="small")
    q3, q4 = st.columns(2, gap="small")

    with q1:
        st.markdown("<div class='quick-grid-btn'>", unsafe_allow_html=True)
        if st.button("📄  Summarize document", use_container_width=True):
            st.session_state.starter_text_input_value = "Can you summarize this document for me?"
            st.session_state.starter_feedback = "✓ Prompt ready — scroll down and hit Start!"
        st.markdown("</div>", unsafe_allow_html=True)

    with q2:
        st.markdown("<div class='quick-grid-btn'>", unsafe_allow_html=True)
        if st.button("🖼️  Explain this image", use_container_width=True):
            st.session_state.starter_text_input_value = "Can you explain this image step by step?"
            st.session_state.starter_feedback = "✓ Prompt ready — scroll down and hit Start!"
        st.markdown("</div>", unsafe_allow_html=True)

    with q3:
        st.markdown("<div class='quick-grid-btn'>", unsafe_allow_html=True)
        if st.button("🧠  Create quiz questions", use_container_width=True):
            st.session_state.starter_text_input_value = "Can you create study questions from these notes?"
            st.session_state.starter_feedback = "✓ Prompt ready — scroll down and hit Start!"
        st.markdown("</div>", unsafe_allow_html=True)

    with q4:
        st.markdown("<div class='quick-grid-btn'>", unsafe_allow_html=True)
        if st.button("✦  Teach it simply", use_container_width=True):
            st.session_state.starter_text_input_value = "Can you explain this topic in a very simple way?"
            st.session_state.starter_feedback = "✓ Prompt ready — scroll down and hit Start!"
        st.markdown("</div>", unsafe_allow_html=True)

    if st.session_state.starter_feedback:
        st.markdown(
            f"<div class='feedback-ok'>✓ {st.session_state.starter_feedback}</div>",
            unsafe_allow_html=True
        )

    st.write("")

    # ── Question input ────────────────────────────────────────────────────────
    st.markdown("<span class='section-label'>Your question</span>", unsafe_allow_html=True)
    starter_input = st.text_input(
        "Question",
        placeholder="e.g.  Explain this topic like I'm 15 years old…",
        key="starter_text_input_value",
        label_visibility="collapsed"
    )

    st.write("")

    # ── CTA button ───────────────────────────────────────────────────────────
    if st.button("🚀  Start Learning", use_container_width=True, type="primary"):
        new_chat_id = create_new_chat(all_chats)
        current_chat = all_chats[new_chat_id]

        if starter_files:
            with st.spinner("Analysing your files…"):
                rag = RAGManager()
                pdf_files = [f for f in starter_files if f.type == "application/pdf"]
                img_files = [f for f in starter_files if f.type in ["image/jpeg", "image/png"]]

                if pdf_files:
                    if "processed_files" not in st.session_state:
                        st.session_state.processed_files = set()
                    for pdf_file in pdf_files:
                        if pdf_file.name not in st.session_state.processed_files:
                            raw_text = get_pdf_text([pdf_file])
                            rag.add_document(raw_text, source_name=pdf_file.name)
                            st.session_state.processed_files.add(pdf_file.name)
                    current_chat["pdf_context"] = "Processed into vector store."

                if img_files:
                    st.session_state.last_image_data = process_image(img_files[-1])

        if starter_input.strip():
            current_chat["messages"].append({"role": "user", "content": starter_input.strip()})
            current_chat["title"] = starter_input.strip()[:25] + "…"
            save_all_chats(all_chats)

        st.session_state.current_chat_id = new_chat_id
        st.session_state.starter_feedback = ""
        st.rerun()