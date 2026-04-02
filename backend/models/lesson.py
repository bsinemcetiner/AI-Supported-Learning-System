from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text
from datetime import datetime
from database import Base


class Lesson(Base):
    __tablename__ = "lessons"

    id = Column(Integer, primary_key=True, index=True)
    lesson_id = Column(String, unique=True, nullable=False, index=True)
    course_id = Column(String, nullable=False, index=True)
    teacher_username = Column(String, nullable=False)
    week_title = Column(String, nullable=False)
    original_filename = Column(String, nullable=False)
    stored_path = Column(String, nullable=False)
    file_hash = Column(String, nullable=False)

    uploaded_at = Column(DateTime, default=datetime.utcnow)

    custom_prompt = Column(Text, default="")
    preview_question = Column(Text, default="")
    draft_explanation = Column(Text, default="")
    approved_explanation = Column(Text, default="")

    last_generated_at = Column(DateTime, nullable=True)
    approved_at = Column(DateTime, nullable=True)
    is_published = Column(Boolean, default=False)