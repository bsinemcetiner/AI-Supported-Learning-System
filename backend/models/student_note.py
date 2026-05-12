from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey
from sqlalchemy.sql import func
from database import Base


class StudentNote(Base):
    __tablename__ = "student_notes"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    course_id = Column(String, nullable=True, index=True)
    lesson_id = Column(String, nullable=True, index=True)
    section_index = Column(Integer, nullable=True)

    course_name = Column(String, nullable=True)
    lesson_title = Column(String, nullable=True)
    section_title = Column(String, nullable=True)

    content = Column(Text, nullable=False, default="")

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)