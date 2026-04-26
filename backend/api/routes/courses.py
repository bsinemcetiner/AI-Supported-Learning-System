from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel

from sqlalchemy.orm import Session

from core.auth import get_current_user, require_teacher
from database import get_db
from services.course_manager import (
    create_course,
    add_material_to_course,
    get_teacher_courses,
    get_all_courses,
    get_course_materials,
    delete_material_from_course,
)
from services.rag_manager import RAGManager
from services.ocr_service import ocr_service

router = APIRouter(prefix="/courses", tags=["courses"])
rag = RAGManager()


class CreateCourseRequest(BaseModel):
    course_name: str


# ── GET /courses ── tüm kurslar (öğrenci için)
@router.get("/")
def list_all_courses(
    _: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return get_all_courses(db)


# ── GET /courses/assigned ── öğrencinin atanmış kursları
@router.get("/assigned")
def list_assigned_courses(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    from models.student_course import StudentCourseAssignment
    from models.course import Course
    from models.user import User
    from models import CourseMaterial

    username = current_user["username"] if isinstance(current_user, dict) else current_user.username
    role = current_user["role"] if isinstance(current_user, dict) else current_user.role

    if role == "teacher":
        return get_teacher_courses(db, username)

    user = db.query(User).filter(User.username == username).first()
    if not user:
        return {}

    assignments = db.query(StudentCourseAssignment).filter_by(student_id=user.id).all()
    course_ids = [a.course_id for a in assignments]

    if not course_ids:
        return {}

    courses = db.query(Course).filter(Course.course_id.in_(course_ids)).all()

    result = {}
    for c in courses:
        materials = db.query(CourseMaterial).filter(CourseMaterial.course_id == c.course_id).all()
        result[c.course_id] = {
            "course_id": c.course_id,
            "course_name": c.course_name,
            "teacher_username": c.teacher_username,
            "created_at": c.created_at.isoformat() if c.created_at else None,
            "materials": [
                {
                    "original_filename": m.original_filename,
                    "stored_path": m.stored_path,
                    "file_hash": m.file_hash,
                    "uploaded_at": m.uploaded_at.isoformat() if m.uploaded_at else None,
                }
                for m in materials
            ],
        }
    return result


# ── GET /courses/mine ── öğretmenin kendi kursları
@router.get("/mine")
def list_my_courses(
    current_user: dict = Depends(require_teacher),
    db: Session = Depends(get_db)
):
    return get_teacher_courses(db, current_user["username"])


# ── POST /courses ── yeni kurs oluştur
@router.post("/", status_code=201)
def create_new_course(
    body: CreateCourseRequest,
    current_user: dict = Depends(require_teacher),
    db: Session = Depends(get_db)
):
    success, message = create_course(db, body.course_name, current_user["username"])
    if not success:
        raise HTTPException(status_code=409, detail=message)
    return {"course_id": message}


# ── POST /courses/{course_id}/materials ── materyal yükle
@router.post("/{course_id}/materials", status_code=201)
async def upload_material(
    course_id: str,
    file: UploadFile = File(...),
    current_user: dict = Depends(require_teacher),
    db: Session = Depends(get_db)
):
    import hashlib, os
    content = await file.read()

    # PDF'i orijinal haliyle kaydet
    pdf_dir = "course_materials_pdf"
    os.makedirs(pdf_dir, exist_ok=True)
    file_hash_raw = hashlib.md5(content).hexdigest()
    safe_course_id = course_id.replace("::", "__").replace("/", "_")
    pdf_filename = f"{safe_course_id}_{file_hash_raw}{os.path.splitext(file.filename)[1]}"
    pdf_path = os.path.join(pdf_dir, pdf_filename)
    with open(pdf_path, "wb") as f:
        f.write(content)

    text = ocr_service.extract_text(content, file.filename)
    if not text:
        raise HTTPException(status_code=422, detail=f"{file.filename}: metin çıkarılamadı")

    add_ok, add_msg = add_material_to_course(
        db=db,
        course_id=course_id,
        filename=file.filename,
        text_content=text,
        pdf_path=pdf_path,
    )
    if not add_ok:
        raise HTTPException(status_code=409, detail=add_msg)

    rag_result = rag.add_document(
        text=text,
        source_name=file.filename,
        course_id=course_id,
        teacher_username=current_user["username"],
    )

    return {
        "filename": file.filename,
        "chunks": rag_result["chunks"],
        "skipped": rag_result["skipped"],
    }


# ── GET /courses/{course_id}/materials/{file_hash}/view ── PDF görüntüle
@router.get("/{course_id}/materials/{file_hash}/view")
def view_material(
    course_id: str,
    file_hash: str,
    _: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    from fastapi.responses import FileResponse
    from models import CourseMaterial
    import os

    material = db.query(CourseMaterial).filter(
        CourseMaterial.course_id == course_id,
        CourseMaterial.file_hash == file_hash
    ).first()

    if not material:
        raise HTTPException(status_code=404, detail="Material not found")

    pdf_path = material.pdf_path
    if not pdf_path or not os.path.exists(pdf_path):
        # Eski materyaller için txt dosyasını döndür
        txt_path = material.stored_path
        if txt_path and os.path.exists(txt_path):
            return FileResponse(
                txt_path,
                media_type="text/plain",
                headers={"Content-Disposition": f"inline; filename=\"{material.original_filename}.txt\""}
            )
        raise HTTPException(status_code=404, detail="File not found on disk")

    ext = os.path.splitext(pdf_path)[1].lower()
    media_type = "application/pdf" if ext == ".pdf" else "application/octet-stream"
    return FileResponse(
        pdf_path,
        media_type=media_type,
        headers={"Content-Disposition": f"inline; filename=\"{material.original_filename}\""}
    )


# ── GET /courses/{course_id}/materials ── materyal listesi
@router.get("/{course_id}/materials")
def list_materials(
    course_id: str,
    _: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return get_course_materials(db, course_id)


# ── DELETE /courses/{course_id}/materials/{file_hash} ── materyal sil
@router.delete("/{course_id}/materials/{file_hash}")
def delete_material(
    course_id: str,
    file_hash: str,
    current_user: dict = Depends(require_teacher),
    db: Session = Depends(get_db)
):
    ok, msg, removed = delete_material_from_course(db, course_id, file_hash)
    if not ok:
        raise HTTPException(status_code=404, detail=msg)

    if removed:
        rag.delete_document(
            source_name=removed.get("original_filename", ""),
            course_id=course_id,
        )

    return {"message": msg}
# ── POST /courses/{course_id}/enroll ── öğrenci kaydol
@router.post("/{course_id}/enroll", status_code=201)
def enroll_course(
    course_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    from models.student_course import StudentCourseAssignment
    from models.user import User

    username = current_user["username"] if isinstance(current_user, dict) else current_user.username
    role = current_user["role"] if isinstance(current_user, dict) else current_user.role

    if role != "student":
        raise HTTPException(status_code=403, detail="Sadece öğrenciler kayıt olabilir")

    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")

    existing = db.query(StudentCourseAssignment).filter_by(
        student_id=user.id, course_id=course_id
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Zaten kayıtlısın")

    assignment = StudentCourseAssignment(student_id=user.id, course_id=course_id)
    db.add(assignment)
    db.commit()
    return {"message": "Kayıt başarılı", "course_id": course_id}


# ── DELETE /courses/{course_id}/unenroll ── öğrenci ayrıl
@router.delete("/{course_id}/unenroll")
def unenroll_course(
    course_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    from models.student_course import StudentCourseAssignment
    from models.user import User

    username = current_user["username"] if isinstance(current_user, dict) else current_user.username

    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")

    assignment = db.query(StudentCourseAssignment).filter_by(
        student_id=user.id, course_id=course_id
    ).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Kayıt bulunamadı")

    db.delete(assignment)
    db.commit()
    return {"message": "Kayıt silindi", "course_id": course_id}