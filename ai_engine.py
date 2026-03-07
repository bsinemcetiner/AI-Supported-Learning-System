import ollama

def get_ai_response(messages, pdf_context, teaching_style):
    style_instructions = {
        "Professional Tutor": "Be formal, structured, and use academic language.",
        "Funny YouTuber": "Use humor, energetic slang, and metaphors like a popular creator.",
        "Deep Scientist": "Provide high-level technical analysis and detailed breakdowns.",
        "Simplified (for kids)": "Use very simple words, fun metaphors, and a teacher-for-kids tone."
    }

    system_instruction = (
        f"You are an AI {teaching_style}. {style_instructions.get(teaching_style, '')} "
        "IMPORTANT: Always use LaTeX for math. Wrap inline math in $ and block math in $$. "
        "DO NOT use <br> tags. Keep responses structured and clear."
    )

    if pdf_context:
        system_instruction += f"\n\nContext from PDF:\n{pdf_context}"

    response = ollama.chat(model='gpt-oss:120b-cloud', messages=[
        {'role': 'system', 'content': system_instruction},
        *messages
    ])

    raw_answer = response['message']['content']
    # Cleaning Layer
    clean_answer = raw_answer.replace('\\(', '$').replace('\\)', '$') \
                             .replace('\\[', '$$').replace('\\]', '$$') \
                             .replace('<br>', ' ')
    return clean_answer