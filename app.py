import streamlit as st
from chat_manager import load_all_chats, save_all_chats, create_new_chat
from file_processor import get_pdf_text, process_image
from ai_engine import get_ai_response

# Page Config
st.set_page_config(page_title="AI Learning Assistant", layout="wide")
all_chats = load_all_chats()

# Session State Initialization
if "current_chat_id" not in st.session_state:
    st.session_state.current_chat_id = None
if "teaching_style" not in st.session_state:
    st.session_state.teaching_style = "Professional Tutor"
if "last_image_data" not in st.session_state:
    st.session_state.last_image_data = None

# SIDEBAR
with st.sidebar:
    st.title("📚 Learning Assistant")
    if st.button("➕ Start New Chat", use_container_width=True):
        create_new_chat(all_chats)
        st.rerun()

    st.divider()
    st.subheader("Recent Conversations")
    for chat_id in reversed(list(all_chats.keys())):
        col_t, col_d = st.columns([0.8, 0.2])
        with col_t:
            if st.button(all_chats[chat_id]["title"], key=f"sel_{chat_id}", use_container_width=True):
                st.session_state.current_chat_id = chat_id
                st.rerun()
        with col_d:
            if st.button("🗑️", key=f"del_{chat_id}"):
                del all_chats[chat_id]
                save_all_chats(all_chats)
                if st.session_state.current_chat_id == chat_id:
                    st.session_state.current_chat_id = None
                st.rerun()

# MAIN SCREEN
if st.session_state.current_chat_id:
    current_chat = all_chats[st.session_state.current_chat_id]
    st.title(f"📍 {current_chat['title']}")

    # Render Messages
    for msg in current_chat["messages"]:
        with st.chat_message(msg["role"]):
            st.markdown(msg["content"])

    # --- MULTIMODAL ACTION BAR ---
    st.write("---")
    up_col, st_col = st.columns([0.65, 0.35])

    with up_col:
        # Accepts both PDFs and Images now
        uploaded_files = st.file_uploader(
            "📁 Upload Study Notes (PDF) or Photos (JPG/PNG)",
            accept_multiple_files=True,
            type=["pdf", "jpg", "png", "jpeg"]
        )
        if uploaded_files:
            with st.spinner("Analyzing files..."):
                pdf_files = [f for f in uploaded_files if f.type == "application/pdf"]
                img_files = [f for f in uploaded_files if f.type in ["image/jpeg", "image/png"]]

                # Process Text
                if pdf_files:
                    current_chat["pdf_context"] = get_pdf_text(pdf_files)

                # Process last uploaded image
                if img_files:
                    st.session_state.last_image_data = process_image(img_files[-1])
                    st.image(img_files[-1], caption="Target Image for Analysis", width=250)

                save_all_chats(all_chats)
                st.toast("Ready for questions!", icon="🚀")

    with st_col:
        st.markdown("### 🎭 Tutor Style")
        st.session_state.teaching_style = st.selectbox(
            "Style", ["Professional Tutor", "Funny YouTuber", "Deep Scientist", "Simplified (for kids)"],
            label_visibility="collapsed"
        )

    # Chat Input
    if prompt := st.chat_input("Ask about your notes or the uploaded image..."):
        current_chat["messages"].append({"role": "user", "content": prompt})
        with st.chat_message("user"):
            st.markdown(prompt)

        with st.chat_message("assistant"):
            # Call the AI Engine with multimodal data
            response = get_ai_response(
                current_chat["messages"],
                current_chat["pdf_context"],
                st.session_state.teaching_style,
                image_data=st.session_state.last_image_data
            )
            st.markdown(response)
            current_chat["messages"].append({"role": "assistant", "content": response})

            if current_chat["title"] == "New Chat":
                current_chat["title"] = prompt[:25] + "..."
            save_all_chats(all_chats)
else:
    st.markdown("### Welcome! Start a chat to begin your learning journey.")