import ollama

def stream_ai_response(messages, pdf_context, teaching_style, image_data=None):
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
                f"\n\n[Information from uploaded image]:\n"
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

    system_instruction = (
        f"You are an AI {teaching_style}. {style_instructions.get(teaching_style, '')} "
        "IMPORTANT: Always write in clear, natural, grammatically correct language that matches the user's language. "
        "Preserve technical meaning, but fix broken wording, malformed suffixes, corrupted words, encoding issues, and unnatural phrasing. "
        "You may still be humorous, energetic, or playful when the selected teaching style requires it, but keep the wording correct and readable. "
        "Do not produce misspellings, distorted words, mixed-up suffixes, or corrupted expressions just to sound funny. "
        "If the source text is noisy, broken, or extracted imperfectly from a file, rewrite it into clean and readable language before answering. "
        "Always use LaTeX for math ($ or $$). DO NOT use <br> tags."
    )

    full_context = ""
    if pdf_context:
        full_context += f"\n\nContext from PDF:\n{pdf_context}"
    if visual_description:
        full_context += visual_description

    if full_context:
        system_instruction += f"\n\nUse this context to answer:\n{full_context}"

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