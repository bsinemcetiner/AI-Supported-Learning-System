import ollama
import json
import os

# File name where conversations will be saved
HISTORY_FILE = "chat_history.json"

import ollama
import json
import os

# File name where conversations will be saved
HISTORY_FILE = "chat_history.json"


def load_history():
    """Loads previous chat history from the JSON file."""
    if os.path.exists(HISTORY_FILE):
        with open(HISTORY_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return []


def save_history(history):
    """Saves the current chat history to the JSON file."""
    with open(HISTORY_FILE, "w", encoding="utf-8") as f:
        json.dump(history, f, ensure_ascii=False, indent=4)


# Load old conversations when the program starts
chat_history = load_history()


def chat_with_tutor(user_input):
    """Sends user input to the AI model and returns the assistant's response."""
    chat_history.append({'role': 'user', 'content': user_input})

    # MODEL UPDATED: gpt-oss:120b-cloud
    response = ollama.chat(model='gpt-oss:120b-cloud', messages=[
        {
            'role': 'system',
            'content': 'You are a highly advanced AI learning assistant with a 120-billion parameter intelligence. Be motivating, remember the student\'s history, and provide deep analytical insights.'
        },
        *chat_history
    ])

    model_response = response['message']['content']
    chat_history.append({'role': 'assistant', 'content': model_response})

    # Save to file after every response
    save_history(chat_history)

    return model_response


# User Interface (Terminal)
print("-" * 30)
print("Learning Assistant (120B Cloud Mode): Active!")
print("Type 'q' to exit the session.")
print("-" * 30)

while True:
    question = input("You: ")
    if question.lower() == 'q':
        # Using your name Yasemin as requested in the personalization logic
        print("Assistant: Good luck with your studies Yasemin, see you next time!")
        break

    try:
        answer = chat_with_tutor(question)
        print(f"\nAssistant: {answer}\n")
    except Exception as e:
        print(f"\nAn error occurred: {e}")
        print("Please ensure Ollama is running and your internet connection is stable.\n")
def load_history():
    """Loads previous chat history from the JSON file."""
    if os.path.exists(HISTORY_FILE):
        with open(HISTORY_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return []


def save_history(history):
    """Saves the current chat history to the JSON file."""
    with open(HISTORY_FILE, "w", encoding="utf-8") as f:
        json.dump(history, f, ensure_ascii=False, indent=4)


# Load old conversations when the program starts
chat_history = load_history()


def chat_with_tutor(user_input):
    """Sends user input to the AI model and returns the assistant's response."""
    chat_history.append({'role': 'user', 'content': user_input})

    # MODEL UPDATED: gpt-oss:120b-cloud
    response = ollama.chat(model='gpt-oss:120b-cloud', messages=[
        {
            'role': 'system',
            'content': 'You are a highly advanced AI learning assistant with a 120-billion parameter intelligence. Be motivating, remember the student\'s history, and provide deep analytical insights.'
        },
        *chat_history
    ])

    model_response = response['message']['content']
    chat_history.append({'role': 'assistant', 'content': model_response})

    # Save to file after every response
    save_history(chat_history)

    return model_response


# User Interface (Terminal)
print("-" * 30)
print("Learning Assistant (120B Cloud Mode): Active!")
print("Type 'q' to exit the session.")
print("-" * 30)

while True:
    question = input("You: ")
    if question.lower() == 'q':
        # Using your name Yasemin as requested in the personalization logic
        print("Assistant: Good luck with your studies Yasemin, see you next time!")
        break

    try:
        answer = chat_with_tutor(question)
        print(f"\nAssistant: {answer}\n")
    except Exception as e:
        print(f"\nAn error occurred: {e}")
        print("Please ensure Ollama is running and your internet connection is stable.\n")