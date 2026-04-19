from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from services.admin_manager import (
    authenticate_admin, get_all_students, get_all_courses,
    assign_course_to_student, remove_course_from_student,
    get_student_courses
)
from schemas.admin import AdminLogin, AssignCourseRequest, RemoveCourseRequest
import jwt, os
from datetime import datetime, timedelta

router = APIRouter(prefix="/admin", tags=["admin"])

SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key")

def create_token(admin_id: int):
    payload = {
        "sub": str(admin_id),
        "role": "admin",
        "exp": datetime.utcnow() + timedelta(hours=8)
    }
    return jwt.encode(payload, SECRET_KEY, algorithm="HS256")

def verify_admin_token(token: str):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        if payload.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Admin değil")
        return payload
    except:
        raise HTTPException(status_code=401, detail="Geçersiz token")

from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
security = HTTPBearer()

def get_current_admin(credentials: HTTPAuthorizationCredentials = Depends(security)):
    return verify_admin_token(credentials.credentials)

@router.post("/login")
def admin_login(data: AdminLogin, db: Session = Depends(get_db)):
    admin = authenticate_admin(db, data.username, data.password)
    if not admin:
        raise HTTPException(status_code=401, detail="Hatalı kullanıcı adı veya şifre")
    token = create_token(admin.id)
    return {"access_token": token, "token_type": "bearer"}

@router.get("/students")
def list_students(db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    students = get_all_students(db)
    return [{"id": s.id, "username": s.username, "email": s.email} for s in students]

@router.get("/courses")
def list_courses(db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    courses = get_all_courses(db)
    return [{"id": c.course_id, "title": c.course_name} for c in courses]

@router.get("/students/{student_id}/courses")
def student_courses(student_id: int, db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    courses = get_student_courses(db, student_id)
    return [{"id": c.course_id, "title": c.course_name} for c in courses]

@router.post("/assign")
def assign(data: AssignCourseRequest, db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    return assign_course_to_student(db, data.student_id, data.course_id)

@router.delete("/remove")
def remove(data: RemoveCourseRequest, db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    return remove_course_from_student(db, data.student_id, data.course_id)