from ai_engine import stream_ai_response

print("Terminal Chat Active (Modular)")
chat_history = []

while True:
    question = input("You: ")
    if question.lower() == "q":
        break

    chat_history.append({"role": "user", "content": question})

    final_answer = ""
    print("\nAssistant: ", end="", flush=True)

    for partial in stream_ai_response(
        chat_history,
        pdf_context="",
        teaching_style="Professional Tutor"
    ):
        new_text = partial[len(final_answer):]
        print(new_text, end="", flush=True)
        final_answer = partial

    print("\n")
    chat_history.append({"role": "assistant", "content": final_answer})