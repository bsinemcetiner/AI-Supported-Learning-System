import json
import os
import hashlib

USERS_FILE = "users.json"


def _ensure_users_file():
    if not os.path.exists(USERS_FILE):
        with open(USERS_FILE, "w", encoding="utf-8") as f:
            json.dump({}, f, ensure_ascii=False, indent=4)


def load_users():
    _ensure_users_file()
    with open(USERS_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def save_users(users):
    with open(USERS_FILE, "w", encoding="utf-8") as f:
        json.dump(users, f, ensure_ascii=False, indent=4)


def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode("utf-8")).hexdigest()


def user_exists(username: str) -> bool:
    users = load_users()
    return username in users


def signup_user(full_name: str, username: str, password: str, role: str):
    users = load_users()

    if username in users:
        return False, "This username already exists."

    if role not in ["student", "teacher"]:
        return False, "Role must be either 'student' or 'teacher'."

    users[username] = {
        "full_name": full_name,
        "username": username,
        "password": hash_password(password),
        "role": role
    }

    save_users(users)
    return True, "Account created successfully."


def login_user(username: str, password: str):
    users = load_users()

    if username not in users:
        return False, "User not found.", None

    hashed = hash_password(password)
    if users[username]["password"] != hashed:
        return False, "Wrong password.", None

    return True, "Login successful.", users[username]