import re
import ollama
from rag_manager import RAGManager

def _normalize_latex(text: str) -> str:
    if not text:
        return ""

    text = text.replace("<br>", " ")

    text = re.sub(r"\\\[(.*?)\\\]", r"\n$$\1$$\n", text, flags=re.DOTALL)

    text = re.sub(r"\\\((.*?)\\\)", r"$\1$", text, flags=re.DOTALL)
    text = re.sub(
        r"(?<!\$)(\\begin\{(?:bmatrix|pmatrix|matrix|vmatrix|Bmatrix)\}.*?\\end\{(?:bmatrix|pmatrix|matrix|vmatrix|Bmatrix)\})(?!\$)",
        r"\n$$\1$$\n",
        text,
        flags=re.DOTALL
    )

    text = re.sub(r"\n{3,}", "\n\n", text)

    return text.strip()

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
3. For lesson/topic questions, first check the uploaded PDF/course context and retrieved excerpts.
4. If the answer is clearly present in the provided PDF/course context, answer from that context confidently.
5. If the answer is NOT clearly present in the provided PDF/course context:
   - clearly say that you could not find a clear or explicit explanation in the uploaded notes/PDF,
   - then still help the user by giving a correct general explanation based on your own knowledge,
   - clearly separate what comes from the notes and what is general knowledge.
6. Do NOT pretend the PDF contains something if it does not.
7. Do NOT stop with only "it is not in the notes"; always try to provide a helpful general explanation unless the user specifically wants answers based only on the PDF.
8. If the notes are partial, noisy, or badly extracted, use your best judgment carefully and mention uncertainty when needed.
9. Clean broken extraction text when needed, but preserve the meaning.
10. Use LaTeX for math ($ or $$).
11. Do NOT use <br> tags.
12. Keep the answer clear, natural, and readable.

RESPONSE STYLE PREFERENCE:
- If the topic is found in the notes, you may explain it normally without rigid section titles.
- If the topic is NOT found in the notes, begin with a brief sentence like:
  "I could not find a clear explanation of this in the uploaded PDF/notes, but generally..."
  Then continue with a useful explanation.

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
        full_answer += piece
        yield _normalize_latex(full_answer)

