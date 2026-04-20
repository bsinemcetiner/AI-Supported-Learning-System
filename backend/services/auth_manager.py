import hashlib
import random
import smtplib
import os
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timedelta
from sqlalchemy.orm import Session

from database import SessionLocal
from models.user import User

# Store OTPs in memory: { email: { otp, expires_at } }
_otp_store: dict = {}


def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode("utf-8")).hexdigest()


def get_role_from_email(email: str):
    email = email.lower().strip()
    if email.endswith("@std.ieu.edu.tr"):
        return "student"
    if email.endswith("@ieu.edu.tr"):
        return "teacher"
    return None


def send_otp_email(to_email: str, otp: str):
    host = os.getenv("EMAIL_HOST", "smtp.gmail.com")
    port = int(os.getenv("EMAIL_PORT", 587))
    user = os.getenv("EMAIL_USER")
    password = os.getenv("EMAIL_PASS")

    msg = MIMEMultipart("alternative")
    msg["Subject"] = "Your Verification Code — Learning Assistant"
    msg["From"] = f"Learning Assistant <{user}>"
    msg["To"] = to_email

    html = f"""
    <div style="font-family:sans-serif;max-width:420px;margin:auto;
                padding:32px;background:#fdf5ef;border-radius:16px;">
      <h2 style="color:#c84b11;">Learning Assistant</h2>
      <p style="color:#555;">Use the code below to verify your email address:</p>
      <div style="font-size:40px;font-weight:bold;letter-spacing:10px;
                  color:#c84b11;margin:24px 0;text-align:center;">{otp}</div>
      <p style="color:#888;font-size:13px;">
        This code is valid for 10 minutes. Do not share it with anyone.
      </p>
    </div>
    """
    msg.attach(MIMEText(html, "html"))

    with smtplib.SMTP(host, port) as server:
        server.starttls()
        server.login(user, password)
        server.sendmail(user, to_email, msg.as_string())


def request_otp(email: str):
    """Send OTP to email. Returns (success, message, role)."""
    email = email.lower().strip()

    role = get_role_from_email(email)
    if not role:
        return False, "Invalid email. Students must use @std.ieu.edu.tr, teachers must use @ieu.edu.tr.", None

    db: Session = SessionLocal()
    try:
        existing = db.query(User).filter(User.email == email).first()
        if existing:
            return False, "This email is already registered.", None
    finally:
        db.close()

    otp = str(random.randint(100000, 999999))
    _otp_store[email] = {
        "otp": otp,
        "expires_at": datetime.utcnow() + timedelta(minutes=10),
    }

    try:
        send_otp_email(email, otp)
    except Exception as e:
        return False, f"Failed to send email: {str(e)}", None

    return True, "OTP sent.", role


def verify_otp(email: str, otp: str):
    email = email.lower().strip()
    record = _otp_store.get(email)

    if not record:
        return False, "OTP not found. Please request a new code."
    if datetime.utcnow() > record["expires_at"]:
        del _otp_store[email]
        return False, "OTP has expired. Please request a new code."
    if record["otp"] != otp:
        return False, "Incorrect code."

    del _otp_store[email]
    return True, "Email verified."


def signup_user(full_name: str, username: str, password: str, role: str, email: str = None):
    db: Session = SessionLocal()
    try:
        existing_user = db.query(User).filter(User.username == username).first()
        if existing_user:
            return False, "This username is already taken."

        if role not in ["student", "teacher"]:
            return False, "Role must be either 'student' or 'teacher'."

        new_user = User(
            full_name=full_name,
            username=username,
            password=hash_password(password),
            role=role,
            email=email,
            password_hash=hash_password(password),
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

        if user.password != hash_password(password):
            return False, "Incorrect password.", None

        return True, "Login successful.", {
            "full_name": user.full_name,
            "username": user.username,
            "role": user.role,
            "email": getattr(user, "email", None),
        }
    finally:
        db.close()