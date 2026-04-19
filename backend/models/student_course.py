from sqlalchemy import Column, Integer, String, ForeignKey
from database import Base

class StudentCourseAssignment(Base):
    __tablename__ = "student_course_assignments"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    course_id = Column(String, nullable=False)