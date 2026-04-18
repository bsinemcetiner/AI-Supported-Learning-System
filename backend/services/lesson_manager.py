import hashlib
from datetime import datetime
from sqlalchemy.orm import Session

from models import Lesson


def _hash_text(text: str) -> str:
    return hashlib.md5(text.encode("utf-8")).hexdigest()


def _lesson_to_dict(lesson: Lesson):
    return {
        "lesson_id": lesson.lesson_id,
        "course_id": lesson.course_id,
        "teacher_username": lesson.teacher_username,
        "week_title": lesson.week_title,
        "original_filename": lesson.original_filename,
        "stored_path": lesson.stored_path,
        "file_hash": lesson.file_hash,
        "uploaded_at": lesson.uploaded_at.isoformat() if lesson.uploaded_at else None,
        "teacher_feedback_history": lesson.teacher_feedback_history or [],
        "custom_prompt": lesson.custom_prompt or "",
        "preview_question": lesson.preview_question or "",
        "draft_explanation": lesson.draft_explanation or "",
        "approved_explanation": lesson.approved_explanation or "",
        "last_generated_at": lesson.last_generated_at.isoformat() if lesson.last_generated_at else None,
        "approved_at": lesson.approved_at.isoformat() if lesson.approved_at else None,
        "is_published": lesson.is_published,
    }


def create_lesson(db: Session, course_id: str, teacher_username: str, week_title: str, filename: str, stored_path: str, text_content: str):
    clean_week = week_title.strip()
    if not clean_week:
        return False, "Week title cannot be empty.", None

    lesson_id = f"{course_id}::{clean_week.lower().replace(' ', '_')}"
    existing = db.query(Lesson).filter(Lesson.lesson_id == lesson_id).first()
    if existing:
        return False, "This week already exists in this course.", None

    file_hash = _hash_text(text_content.strip())

    lesson = Lesson(
        lesson_id=lesson_id,
        course_id=course_id,
        teacher_username=teacher_username,
        week_title=clean_week,
        original_filename=filename,
        stored_path=stored_path,
        file_hash=file_hash,
        uploaded_at=datetime.utcnow(),
        teacher_feedback_history=[],
        custom_prompt="",
        preview_question=(
            "Teach this lesson as a natural spoken teaching script. "
            "Do not use bullet points unless absolutely necessary. "
            "Explain it clearly, conversationally, and in a teacher-like tone."
        ),
        draft_explanation="",
        approved_explanation="",
        last_generated_at=None,
        approved_at=None,
        is_published=False,
    )

    db.add(lesson)
    db.commit()
    db.refresh(lesson)

    return True, "Lesson created successfully.", lesson.lesson_id


def get_lessons_by_course(db: Session, course_id: str):
    lessons = db.query(Lesson).filter(Lesson.course_id == course_id).order_by(Lesson.uploaded_at.asc()).all()
    return {lesson.lesson_id: _lesson_to_dict(lesson) for lesson in lessons}


def get_lesson_by_id(db: Session, lesson_id: str):
    lesson = db.query(Lesson).filter(Lesson.lesson_id == lesson_id).first()
    return _lesson_to_dict(lesson) if lesson else None


def update_lesson_feedback(db: Session, lesson_id: str, feedback_text: str, custom_prompt: str = None):
    lesson = db.query(Lesson).filter(Lesson.lesson_id == lesson_id).first()
    if not lesson:
        return False, "Lesson not found."

    feedback_text = (feedback_text or "").strip()
    history = lesson.teacher_feedback_history or []

    if feedback_text:
        history.append(feedback_text)
        lesson.teacher_feedback_history = history

    if custom_prompt is not None:
        lesson.custom_prompt = custom_prompt.strip()

    db.commit()
    return True, "Lesson feedback updated."


def set_lesson_preview_question(db: Session, lesson_id: str, preview_question: str):
    lesson = db.query(Lesson).filter(Lesson.lesson_id == lesson_id).first()
    if not lesson:
        return False, "Lesson not found."

    lesson.preview_question = preview_question.strip()
    db.commit()
    return True, "Preview question updated."


def set_lesson_published(db: Session, lesson_id: str, is_published: bool):
    lesson = db.query(Lesson).filter(Lesson.lesson_id == lesson_id).first()
    if not lesson:
        return False, "Lesson not found."

    lesson.is_published = bool(is_published)
    db.commit()
    return True, "Lesson publish state updated."


def save_draft_explanation(db: Session, lesson_id: str, draft_text: str):
    lesson = db.query(Lesson).filter(Lesson.lesson_id == lesson_id).first()
    if not lesson:
        return False, "Lesson not found."

    lesson.draft_explanation = (draft_text or "").strip()
    lesson.last_generated_at = datetime.utcnow()
    db.commit()
    return True, "Draft explanation saved."


def approve_lesson_explanation(db: Session, lesson_id: str):
    lesson = db.query(Lesson).filter(Lesson.lesson_id == lesson_id).first()
    if not lesson:
        return False, "Lesson not found."

    draft_text = (lesson.draft_explanation or "").strip()
    if not draft_text:
        return False, "No draft explanation available to approve."

    lesson.approved_explanation = draft_text
    lesson.approved_at = datetime.utcnow()
    lesson.is_published = True
    db.commit()
    return True, "Lesson approved and published."


def get_student_visible_explanation(db: Session, lesson_id: str):
    lesson = db.query(Lesson).filter(Lesson.lesson_id == lesson_id).first()
    if not lesson:
        return None

    approved = (lesson.approved_explanation or "").strip()
    if approved:
        return approved

    draft = (lesson.draft_explanation or "").strip()
    if draft:
        return draft

    return ""