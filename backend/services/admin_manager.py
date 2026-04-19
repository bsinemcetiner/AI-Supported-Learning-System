from sqlalchemy.orm import Session
from models.admin import Admin
from models.student_course import StudentCourseAssignment
from models.user import User
from models.course import Course
import hashlib

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

def verify_password(plain: str, hashed: str) -> bool:
    return hashlib.sha256(plain.encode()).hexdigest() == hashed

def get_password_hash(password: str) -> str:
    return hash_password(password)

def authenticate_admin(db: Session, username: str, password: str):
    admin = db.query(Admin).filter(Admin.username == username).first()
    if not admin or not verify_password(password, admin.hashed_password):
        return None
    return admin

def create_admin(db: Session, username: str, password: str):
    existing = db.query(Admin).filter(Admin.username == username).first()
    if existing:
        return None
    admin = Admin(username=username, hashed_password=get_password_hash(password))
    db.add(admin)
    db.commit()
    db.refresh(admin)
    return admin

def get_all_students(db: Session):
    return db.query(User).filter(User.role == "student").all()

def get_all_teachers(db: Session):
    return db.query(User).filter(User.role == "teacher").all()

def get_all_courses(db: Session):
    return db.query(Course).all()

def assign_course_to_student(db: Session, student_id: int, course_id: str):
    existing = db.query(StudentCourseAssignment).filter_by(
        student_id=student_id, course_id=course_id
    ).first()
    if existing:
        return {"message": "Zaten atanmış"}
    assignment = StudentCourseAssignment(student_id=student_id, course_id=course_id)
    db.add(assignment)
    db.commit()
    return {"message": "Atama başarılı"}

def remove_course_from_student(db: Session, student_id: int, course_id: str):
    assignment = db.query(StudentCourseAssignment).filter_by(
        student_id=student_id, course_id=course_id
    ).first()
    if not assignment:
        return {"message": "Atama bulunamadı"}
    db.delete(assignment)
    db.commit()
    return {"message": "Atama kaldırıldı"}

def get_student_courses(db: Session, student_id: int):
    assignments = db.query(StudentCourseAssignment).filter_by(student_id=student_id).all()
    course_ids = [a.course_id for a in assignments]
    return db.query(Course).filter(Course.course_id.in_(course_ids)).all()