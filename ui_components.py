import streamlit as st
from chat_manager import save_all_chats, create_new_chat
from file_processor import get_pdf_text, process_image
from ai_engine import stream_ai_response


def render_sidebar(all_chats):
    if "editing_chat_id" not in st.session_state:
        st.session_state.editing_chat_id = None
    if "editing_chat_title" not in st.session_state:
        st.session_state.editing_chat_title = ""

    with st.sidebar:
        st.title("📚 Learning Assistant")

        if st.button("➕ Start New Chat", use_container_width=True):
            create_new_chat(all_chats)
            st.session_state.last_image_data = None
            st.rerun()

        st.divider()
        st.subheader("Recent Conversations")

        for chat_id in reversed(list(all_chats.keys())):
            title = all_chats[chat_id]["title"]
            short_title = title if len(title) <= 24 else title[:24] + "..."

            row_col1, row_col2 = st.columns([0.82, 0.18])

            with row_col1:
                if st.button(
                    short_title,
                    key=f"sel_{chat_id}",
                    use_container_width=True
                ):
                    st.session_state.current_chat_id = chat_id
                    st.rerun()

            with row_col2:
                with st.popover("⋮", use_container_width=True):
                    st.markdown(f"**{title}**")

                    if st.button("✏️ Rename", key=f"rename_btn_{chat_id}", use_container_width=True):
                        st.session_state.editing_chat_id = chat_id
                        st.session_state.editing_chat_title = title
                        st.rerun()

                    if st.button("🗑️ Delete", key=f"delete_btn_{chat_id}", use_container_width=True):
                        del all_chats[chat_id]
                        save_all_chats(all_chats)

                        if st.session_state.current_chat_id == chat_id:
                            st.session_state.current_chat_id = None

                        if st.session_state.editing_chat_id == chat_id:
                            st.session_state.editing_chat_id = None
                            st.session_state.editing_chat_title = ""

                        st.rerun()

            if st.session_state.editing_chat_id == chat_id:
                new_title = st.text_input(
                    "Rename chat",
                    value=st.session_state.editing_chat_title,
                    key=f"rename_input_{chat_id}"
                )

                save_col, cancel_col = st.columns(2)

                with save_col:
                    if st.button("Save", key=f"save_{chat_id}", use_container_width=True):
                        cleaned = new_title.strip()
                        if cleaned:
                            all_chats[chat_id]["title"] = cleaned
                            save_all_chats(all_chats)

                        st.session_state.editing_chat_id = None
                        st.session_state.editing_chat_title = ""
                        st.rerun()

                with cancel_col:
                    if st.button("Cancel", key=f"cancel_{chat_id}", use_container_width=True):
                        st.session_state.editing_chat_id = None
                        st.session_state.editing_chat_title = ""
                        st.rerun()

def render_chat_screen(all_chats):
    current_chat = all_chats[st.session_state.current_chat_id]

    top_bar_col1, top_bar_col2 = st.columns([0.2, 0.8])

    with top_bar_col1:
        if st.button("← Back to Home", use_container_width=True):
            st.session_state.current_chat_id = None
            st.session_state.last_image_data = None
            st.rerun()

    with top_bar_col2:
        st.title(f"📍 {current_chat['title']}")

    for msg in current_chat["messages"]:
        with st.chat_message(msg["role"]):
            st.markdown(msg["content"])

    st.write("---")
    up_col, st_col = st.columns([0.65, 0.35])

    with up_col:
        uploaded_files = st.file_uploader(
            "📁 Upload Study Notes (PDF) or Photos (JPG/PNG)",
            accept_multiple_files=True,
            type=["pdf", "jpg", "png", "jpeg"],
            key="chat_file_uploader"
        )

        if uploaded_files:
            with st.spinner("Analyzing files..."):
                pdf_files = [
                    f for f in uploaded_files
                    if f.type == "application/pdf"
                ]
                img_files = [
                    f for f in uploaded_files
                    if f.type in ["image/jpeg", "image/png"]
                ]

                if pdf_files:
                    current_chat["pdf_context"] = get_pdf_text(pdf_files)

                if img_files:
                    st.session_state.last_image_data = process_image(img_files[-1])
                    st.image(
                        img_files[-1],
                        caption="Target Image for Analysis",
                        width=250
                    )

                save_all_chats(all_chats)
                st.toast("Ready for questions!", icon="🚀")

    with st_col:
        st.markdown("### 🎭 Tutor Style")
        st.session_state.teaching_style = st.selectbox(
            "Style",
            [
                "Professional Tutor",
                "Funny YouTuber",
                "Deep Scientist",
                "Simplified (for kids)"
            ],
            label_visibility="collapsed",
            key="chat_style_select"
        )

    prompt = st.chat_input("Ask about your notes or the uploaded image...")

    if prompt:
        current_chat["messages"].append({"role": "user", "content": prompt})

        with st.chat_message("user"):
            st.markdown(prompt)

        with st.chat_message("assistant"):
            response_placeholder = st.empty()
            final_response = ""

            for partial_response in stream_ai_response(
                current_chat["messages"],
                current_chat.get("pdf_context", ""),
                st.session_state.teaching_style,
                image_data=st.session_state.last_image_data
            ):
                final_response = partial_response
                response_placeholder.markdown(final_response + "▌")

            response_placeholder.markdown(final_response)

        current_chat["messages"].append(
            {"role": "assistant", "content": final_response}
        )

        if current_chat["title"] == "New Chat":
            current_chat["title"] = prompt[:25] + "..."

        save_all_chats(all_chats)


def render_starter_dashboard(all_chats):
    if "starter_text_input_value" not in st.session_state:
        st.session_state.starter_text_input_value = ""
    if "starter_feedback" not in st.session_state:
        st.session_state.starter_feedback = ""

    st.markdown(
        """
        <h1 style='text-align: center;'>Start a New Learning Session</h1>
        <p style='text-align: center; font-size: 18px; color: #B0B0B0;'>
            Upload your notes or images, choose a tutor style, and start learning instantly.
        </p>
        """,
        unsafe_allow_html=True
    )

    st.write("")
    st.write("")

    st.markdown("### 📘 How to Use")
    st.markdown(
        """
        1. Upload a PDF or image  
        2. Choose a tutor style  
        3. Select a quick prompt or type your own question  
        4. Click **Start Learning**
        """
    )

    st.write("")

    top_col1, top_col2 = st.columns([0.65, 0.35])

    with top_col1:
        starter_files = st.file_uploader(
            "📁 Upload Study Notes (PDF) or Photos (JPG/PNG)",
            accept_multiple_files=True,
            type=["pdf", "jpg", "png", "jpeg"],
            key="starter_file_uploader"
        )

    with top_col2:
        st.markdown("### 🎭 Tutor Style")
        st.session_state.teaching_style = st.selectbox(
            "Style",
            [
                "Professional Tutor",
                "Funny YouTuber",
                "Deep Scientist",
                "Simplified (for kids)"
            ],
            label_visibility="collapsed",
            key="starter_style_select"
        )

    st.write("")
    st.markdown("### ✨ Quick Start Prompts")

    pcol1, pcol2 = st.columns(2)
    pcol3, pcol4 = st.columns(2)

    with pcol1:
        if st.button("📄 Summarize this document", use_container_width=True):
            st.session_state.starter_text_input_value = "Can you summarize this document for me?"
            st.session_state.starter_feedback = "Prompt added below."

    with pcol2:
        if st.button("🖼️ Explain this image", use_container_width=True):
            st.session_state.starter_text_input_value = "Can you explain this image step by step?"
            st.session_state.starter_feedback = "Prompt added below."

    with pcol3:
        if st.button("🧠 Create quiz questions", use_container_width=True):
            st.session_state.starter_text_input_value = "Can you create study questions from these notes?"
            st.session_state.starter_feedback = "Prompt added below."

    with pcol4:
        if st.button("👶 Teach it simply", use_container_width=True):
            st.session_state.starter_text_input_value = "Can you explain this topic in a very simple way?"
            st.session_state.starter_feedback = "Prompt added below."

    if st.session_state.starter_feedback:
        st.success(st.session_state.starter_feedback)

    st.write("")
    st.markdown("### 💬 Your First Question")

    starter_input = st.text_input(
        "Type your question here",
        placeholder="Example: Explain this PDF in Turkish",
        key="starter_text_input_value"
    )

    st.write("")

    if st.button("🚀 Start Learning", use_container_width=True):
        new_chat_id = create_new_chat(all_chats)
        current_chat = all_chats[new_chat_id]

        if starter_files:
            with st.spinner("Analyzing files..."):
                pdf_files = [
                    f for f in starter_files
                    if f.type == "application/pdf"
                ]
                img_files = [
                    f for f in starter_files
                    if f.type in ["image/jpeg", "image/png"]
                ]

                if pdf_files:
                    current_chat["pdf_context"] = get_pdf_text(pdf_files)

                if img_files:
                    st.session_state.last_image_data = process_image(img_files[-1])

        if starter_input.strip():
            current_chat["messages"].append(
                {"role": "user", "content": starter_input.strip()}
            )
            current_chat["title"] = starter_input.strip()[:25] + "..."
            save_all_chats(all_chats)

        st.session_state.current_chat_id = new_chat_id
        st.session_state.starter_feedback = ""
        st.rerun()