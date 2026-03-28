import json
import os
import hashlib
from datetime import datetime

LESSONS_FILE = "lessons.json"


def _ensure_lessons_file():
    if not os.path.exists(LESSONS_FILE):
        with open(LESSONS_FILE, "w", encoding="utf-8") as f:
            json.dump({}, f, ensure_ascii=False, indent=4)


def load_lessons():
    _ensure_lessons_file()
    with open(LESSONS_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def save_lessons(lessons):
    with open(LESSONS_FILE, "w", encoding="utf-8") as f:
        json.dump(lessons, f, ensure_ascii=False, indent=4)


def _hash_text(text: str) -> str:
    return hashlib.md5(text.encode("utf-8")).hexdigest()


def create_lesson(
    course_id: str,
    teacher_username: str,
    week_title: str,
    filename: str,
    stored_path: str,
    text_content: str,
):
    lessons = load_lessons()

    clean_week = week_title.strip()
    if not clean_week:
        return False, "Week title cannot be empty.", None

    lesson_id = f"{course_id}::{clean_week.lower().replace(' ', '_')}"
    if lesson_id in lessons:
        return False, "This week already exists in this course.", None

    file_hash = _hash_text(text_content.strip())

    lessons[lesson_id] = {
        "lesson_id": lesson_id,
        "course_id": course_id,
        "teacher_username": teacher_username,
        "week_title": clean_week,
        "original_filename": filename,
        "stored_path": stored_path,
        "file_hash": file_hash,
        "uploaded_at": datetime.now().isoformat(),
        "teacher_feedback_history": [],
        "custom_prompt": "",
        "preview_question": (
            "Teach this lesson as a natural spoken teaching script. "
            "Do not use bullet points unless absolutely necessary. "
            "Explain it clearly, conversationally, and in a teacher-like tone."
        ),
        "draft_explanation": "",
        "approved_explanation": "",
        "last_generated_at": None,
        "approved_at": None,
        "is_published": False,
    }

    save_lessons(lessons)
    return True, "Lesson created successfully.", lesson_id


def get_lessons_by_course(course_id: str):
    lessons = load_lessons()
    result = {
        lid: ldata
        for lid, ldata in lessons.items()
        if ldata.get("course_id") == course_id
    }
    return dict(sorted(result.items(), key=lambda x: x[1].get("uploaded_at", "")))


def get_lesson_by_id(lesson_id: str):
    lessons = load_lessons()
    return lessons.get(lesson_id)


def update_lesson_feedback(lesson_id: str, feedback_text: str, custom_prompt: str = None):
    lessons = load_lessons()

    if lesson_id not in lessons:
        return False, "Lesson not found."

    feedback_text = (feedback_text or "").strip()
    if feedback_text:
        lessons[lesson_id].setdefault("teacher_feedback_history", []).append(feedback_text)

    if custom_prompt is not None:
        lessons[lesson_id]["custom_prompt"] = custom_prompt.strip()

    save_lessons(lessons)
    return True, "Lesson feedback updated."


def set_lesson_preview_question(lesson_id: str, preview_question: str):
    lessons = load_lessons()

    if lesson_id not in lessons:
        return False, "Lesson not found."

    lessons[lesson_id]["preview_question"] = preview_question.strip()
    save_lessons(lessons)
    return True, "Preview question updated."


def set_lesson_published(lesson_id: str, is_published: bool):
    lessons = load_lessons()

    if lesson_id not in lessons:
        return False, "Lesson not found."

    lessons[lesson_id]["is_published"] = bool(is_published)
    save_lessons(lessons)
    return True, "Lesson publish state updated."


def save_draft_explanation(lesson_id: str, draft_text: str):
    lessons = load_lessons()

    if lesson_id not in lessons:
        return False, "Lesson not found."

    lessons[lesson_id]["draft_explanation"] = (draft_text or "").strip()
    lessons[lesson_id]["last_generated_at"] = datetime.now().isoformat()
    save_lessons(lessons)
    return True, "Draft explanation saved."


def approve_lesson_explanation(lesson_id: str):
    lessons = load_lessons()

    if lesson_id not in lessons:
        return False, "Lesson not found."

    draft_text = (lessons[lesson_id].get("draft_explanation") or "").strip()
    if not draft_text:
        return False, "No draft explanation available to approve."

    lessons[lesson_id]["approved_explanation"] = draft_text
    lessons[lesson_id]["approved_at"] = datetime.now().isoformat()
    lessons[lesson_id]["is_published"] = True

    save_lessons(lessons)
    return True, "Lesson approved and published."


def get_student_visible_explanation(lesson_id: str):
    lessons = load_lessons()

    if lesson_id not in lessons:
        return None

    approved = (lessons[lesson_id].get("approved_explanation") or "").strip()
    if approved:
        return approved

    draft = (lessons[lesson_id].get("draft_explanation") or "").strip()
    if draft:
        return draft

    return ""