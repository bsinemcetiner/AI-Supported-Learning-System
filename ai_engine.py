import ollama

def get_ai_response(messages, pdf_context, teaching_style, image_data=None):
    visual_description = ""
    if image_data:
        vision_response = ollama.chat(
            model='llama3.2-vision',
            messages=[{'role': 'user', 'content': 'Analyze this image in detail. Extract all text, code, and explain diagrams.', 'images': [image_data]}]
        )
        visual_description = f"\n\n[Information from uploaded image]:\n{vision_response['message']['content']}"

    style_instructions = {
        "Professional Tutor": "Be formal, structured, and use academic language.",
        "Funny YouTuber": "Use humor, energetic slang, and metaphors.",
        "Deep Scientist": "Provide high-level technical analysis.",
        "Simplified (for kids)": "Use simple words and metaphors."
    }

    system_instruction = (
        f"You are an AI {teaching_style}. {style_instructions.get(teaching_style, '')} "
        "IMPORTANT: Always use LaTeX for math ($ or $$). DO NOT use <br> tags."
    )

    full_context = ""
    if pdf_context:
        full_context += f"\n\nContext from PDF:\n{pdf_context}"
    if visual_description:
        full_context += visual_description

    if full_context:
        system_instruction += f"\n\nUse this context to answer:\n{full_context}"

    response = ollama.chat(
        model='gpt-oss:120b-cloud',
        messages=[{'role': 'system', 'content': system_instruction}] + messages
    )

    raw_answer = response['message']['content']
    return raw_answer.replace('\\(', '$').replace('\\)', '$').replace('\\[', '$$').replace('\\]', '$$').replace('<br>', ' ')