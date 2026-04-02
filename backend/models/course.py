from sqlalchemy import Column, Integer, String, DateTime
from datetime import datetime
from database import Base


class Course(Base):
    __tablename__ = "courses"

    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(String, unique=True, nullable=False, index=True)
    course_name = Column(String, nullable=False)
    teacher_username = Column(String, nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)