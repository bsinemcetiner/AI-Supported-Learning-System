import ollama
from rag_manager import RAGManager


def _trim_text(text: str, max_chars: int = 18000) -> str:
    if not text:
        return ""
    text = text.strip()
    if len(text) <= max_chars:
        return text
    return text[:max_chars] + "\n\n[Context truncated for length.]"


def stream_ai_response(messages, pdf_context, teaching_style, image_data=None):
    rag = RAGManager()
    last_user_message = messages[-1]["content"]

    retrieved_context = rag.query_context(last_user_message)
    visual_description = ""

    if image_data:
        try:
            vision_response = ollama.chat(
                model="llama3.2-vision",
                messages=[
                    {
                        "role": "user",
                        "content": "Analyze this image in detail. Extract all text, code, and explain diagrams.",
                        "images": [image_data]
                    }
                ]
            )
            visual_description = (
                "\n\n[Information from uploaded image]:\n"
                f"{vision_response['message']['content']}"
            )
        except Exception:
            visual_description = (
                "\n\n[Image analysis could not be completed because of insufficient system memory. "
                "Please try again with a smaller image or close other applications.]"
            )

    style_instructions = {
        "Professional Tutor": "Be formal, structured, and use academic language.",
        "Funny YouTuber": "Use humor, energetic expressions, and playful metaphors, but keep the language grammatically correct and easy to read.",
        "Deep Scientist": "Provide high-level technical analysis.",
        "Simplified (for kids)": "Use simple words and metaphors."
    }

    cleaned_pdf_context = _trim_text(pdf_context, 18000)
    cleaned_retrieved_context = _trim_text(retrieved_context, 6000)

    context_blocks = []

    if cleaned_pdf_context:
        context_blocks.append(
            f"[PRIMARY COURSE / PDF CONTEXT]\n{cleaned_pdf_context}"
        )

    if cleaned_retrieved_context:
        context_blocks.append(
            f"[RETRIEVED RELEVANT EXCERPTS]\n{cleaned_retrieved_context}"
        )

    if visual_description:
        context_blocks.append(visual_description)

    combined_context = "\n\n---\n\n".join(context_blocks).strip()

    system_instruction = f"""
You are an AI learning assistant with the style "{teaching_style}".
{style_instructions.get(teaching_style, "")}

IMPORTANT BEHAVIOR RULES:
1. Always reply in the user's language.
2. For greetings, thanks, or casual small talk, reply naturally without forcing document context.
3. For lesson/topic questions:
   - First use the CURRENT PDF / course context if it exists.
   - Then use retrieved relevant excerpts as supporting evidence.
   - If the answer is clearly present in the provided PDF/course context, answer confidently from it.
   - If the answer is not present, say that it is not explicitly found in the provided notes.
4. Do NOT ignore the PDF context just because retrieval is weak or incomplete.
5. Clean broken extraction text when needed, but preserve the meaning.
6. Use LaTeX for math ($ or $$).
7. Do NOT use <br> tags.
8. Keep the answer clear, natural, and readable.

CONTEXT AVAILABLE TO YOU:
{combined_context if combined_context else "No document context provided."}
""".strip()

    stream = ollama.chat(
        model="gpt-oss:120b-cloud",
        messages=[{"role": "system", "content": system_instruction}] + messages,
        stream=True
    )

    full_answer = ""

    for chunk in stream:
        piece = chunk["message"]["content"]
        piece = (
            piece
            .replace("\\(", "$")
            .replace("\\)", "$")
            .replace("\\[", "$$")
            .replace("\\]", "$$")
            .replace("<br>", " ")
        )
        full_answer += piece
        yield full_answer