from sqlalchemy import Column, Integer, String, Text, DateTime
from sqlalchemy.sql import func
from database import Base


class QuestionLog(Base):
    __tablename__ = "question_logs"

    id = Column(Integer, primary_key=True, index=True)
    lesson_id = Column(String, nullable=False, index=True)
    section_index = Column(Integer, nullable=False)
    course_id = Column(String, nullable=False, index=True)
    student_question = Column(Text, nullable=True)
    asked_at = Column(DateTime(timezone=True), server_default=func.now())
