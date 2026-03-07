from ai_engine import get_ai_response

print("--- Terminal Chat Active (Modular) ---")
chat_history = []

while True:
    question = input("You: ")
    if question.lower() == 'q': break

    answer = get_ai_response(chat_history, pdf_context="", teaching_style="Professional Tutor")
    print(f"\nAssistant: {answer}\n")
    chat_history.append({'role': 'user', 'content': question})
    chat_history.append({'role': 'assistant', 'content': answer})