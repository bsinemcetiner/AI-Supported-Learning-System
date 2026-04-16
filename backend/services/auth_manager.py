import hashlib
from sqlalchemy.orm import Session

from database import SessionLocal
from models.user import User


def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode("utf-8")).hexdigest()


def signup_user(full_name: str, username: str, password: str, role: str):
    db: Session = SessionLocal()
    try:
        existing_user = db.query(User).filter(User.username == username).first()
        if existing_user:
            return False, "This username already exists."

        if role not in ["student", "teacher"]:
            return False, "Role must be either 'student' or 'teacher'."

        new_user = User(
            full_name=full_name,
            username=username,
            password=hash_password(password),
            role=role
        )

        db.add(new_user)
        db.commit()
        db.refresh(new_user)

        return True, "Account created successfully."
    finally:
        db.close()


def login_user(username: str, password: str):
    db: Session = SessionLocal()
    try:
        user = db.query(User).filter(User.username == username).first()

        if not user:
            return False, "User not found.", None

        hashed = hash_password(password)
        if user.password != hashed:
            return False, "Wrong password.", None

        return True, "Login successful.", {
            "full_name": user.full_name,
            "username": user.username,
            "role": user.role
        }
    finally:
        db.close()