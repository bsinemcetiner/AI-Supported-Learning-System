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
    delete_course,
)
from services.rag_manager import RAGManager
from services.ocr_service import ocr_service
from api.routes.notifications import create_notification

router = APIRouter(prefix="/courses", tags=["courses"])
rag = RAGManager()

def _serialize_material(m):
    import os

    pdf_path = getattr(m, "pdf_path", None)
    file_url = None

    if pdf_path:
        normalized_pdf_path = str(pdf_path).replace("\\", "/")
        pdf_filename = os.path.basename(normalized_pdf_path)
        file_url = f"/course_materials_pdf/{pdf_filename}"

    return {
        "original_filename": m.original_filename,
        "stored_path": m.stored_path,
        "pdf_path": pdf_path,
        "file_url": file_url,
        "file_hash": m.file_hash,
        "uploaded_at": m.uploaded_at.isoformat() if m.uploaded_at else None,
    }


def _serialize_course_with_materials(db: Session, course):
    from models import CourseMaterial

    materials = (
        db.query(CourseMaterial)
        .filter(CourseMaterial.course_id == course.course_id)
        .order_by(CourseMaterial.uploaded_at.desc())
        .all()
    )

    return {
        "course_id": course.course_id,
        "course_name": course.course_name,
        "teacher_username": course.teacher_username,
        "created_at": course.created_at.isoformat() if course.created_at else None,
        "materials": [_serialize_material(m) for m in materials],
    }


class CreateCourseRequest(BaseModel):
    course_name: str


@router.get("/")
def list_all_courses(
    _: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    from models.course import Course

    courses = db.query(Course).all()

    return {
        c.course_id: _serialize_course_with_materials(db, c)
        for c in courses
    }



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
        courses = db.query(Course).filter(Course.teacher_username == username).all()
        return {
            c.course_id: _serialize_course_with_materials(db, c)
            for c in courses
        }

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
            "materials": [_serialize_material(m) for m in materials],
        }
    return result


@router.get("/mine")
def list_my_courses(
    current_user: dict = Depends(require_teacher),
    db: Session = Depends(get_db)
):
    from models.course import Course

    courses = (
        db.query(Course)
        .filter(Course.teacher_username == current_user["username"])
        .all()
    )

    return {
        c.course_id: _serialize_course_with_materials(db, c)
        for c in courses
    }



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



@router.post("/{course_id}/materials", status_code=201)
async def upload_material(
    course_id: str,
    file: UploadFile = File(...),
    current_user: dict = Depends(require_teacher),
    db: Session = Depends(get_db)
):
    import hashlib, os, re




    MAX_SIZE = 20 * 1024 * 1024
    content = await file.read()
    if len(content) > MAX_SIZE:
        raise HTTPException(status_code=413, detail="File size cannot exceed 20MB")


    if not content.startswith(b"%PDF"):
        raise HTTPException(status_code=400, detail="Only valid PDF files are accepted")


    original_name = file.filename or "upload.pdf"
    ext = os.path.splitext(original_name)[1].lower()
    if ext != ".pdf":
        raise HTTPException(status_code=400, detail="Only files with the .pdf extension are accepted")


    allowed_types = {"application/pdf", "application/octet-stream"}
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail=f"Invalid file type: {file.content_type}")


    safe_filename = re.sub(r"[^\w\-.]", "_", os.path.basename(original_name))
    if not safe_filename or safe_filename.startswith("."):
        safe_filename = "upload.pdf"

    # ─────────────────────────────────────────────────────────────────


    pdf_dir = "course_materials_pdf"
    os.makedirs(pdf_dir, exist_ok=True)
    file_hash_raw = hashlib.md5(content).hexdigest()
    safe_course_id = course_id.replace("::", "__").replace("/", "_")
    pdf_filename = f"{safe_course_id}_{file_hash_raw}{os.path.splitext(safe_filename)[1]}"
    pdf_path = os.path.join(pdf_dir, pdf_filename)
    with open(pdf_path, "wb") as f:
        f.write(content)

    text = ocr_service.extract_text(content, file.filename)
    if not text:
        raise HTTPException(status_code=422, detail=f"{safe_filename}: text could not be extracted")

    add_ok, add_msg = add_material_to_course(
        db=db,
        course_id=course_id,
        filename=safe_filename,
        text_content=text,
        pdf_path=pdf_path,
    )
    if not add_ok:
        raise HTTPException(status_code=409, detail=add_msg)

    notification_created = False

    try:
        create_notification(
            db=db,
            course_id=course_id,
            title="New material uploaded",
            message=f"A new material has been uploaded: {safe_filename}",
            created_by=current_user["username"],
            type="material_uploaded",
        )
        notification_created = True
    except Exception as e:
        print("Material notification error:", e)

    try:
        rag_result = rag.add_document(
            text=text,
            source_name=safe_filename,
            course_id=course_id,
            teacher_username=current_user["username"],
        )
    except Exception as e:
        print("Material RAG indexing error:", e)
        rag_result = {
            "chunks": 0,
            "skipped": True,
        }

    return {
        "filename": file.filename,
        "chunks": rag_result["chunks"],
        "skipped": rag_result["skipped"],
        "notification_created": notification_created,
    }

# ── GET /courses/{course_id}/materials/{file_hash}/view
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


# ── GET /courses/{course_id}/materials
@router.get("/{course_id}/materials")
def list_materials(
    course_id: str,
    _: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    from models import CourseMaterial

    materials = (
        db.query(CourseMaterial)
        .filter(CourseMaterial.course_id == course_id)
        .order_by(CourseMaterial.uploaded_at.desc())
        .all()
    )

    return [_serialize_material(m) for m in materials]



# ── DELETE /courses/{course_id}/materials/{file_hash}
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
# ── POST /courses/{course_id}/enroll
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
        raise HTTPException(status_code=403, detail="Only students can enroll")

    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    existing = db.query(StudentCourseAssignment).filter_by(
        student_id=user.id, course_id=course_id
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="You are already enrolled")

    assignment = StudentCourseAssignment(student_id=user.id, course_id=course_id)
    db.add(assignment)
    db.commit()
    return {"message": "Enrollment successful", "course_id": course_id}


# ── DELETE /courses/{course_id}/unenroll ── student unenroll
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
        raise HTTPException(status_code=404, detail="User not found")

    assignment = db.query(StudentCourseAssignment).filter_by(
        student_id=user.id, course_id=course_id
    ).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Enrollment not found")

    db.delete(assignment)
    db.commit()
    return {"message": "Enrollment removed", "course_id": course_id}

@router.delete("/{course_id}")
def delete_course_endpoint(
    course_id: str,
    current_user: dict = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    """Delete a course and all its lessons."""
    # Also clean up section JSON files
    import os, json
    from services.lesson_manager import get_lessons_by_course
    lessons = get_lessons_by_course(db, course_id)
    sections_dir = "lesson_sections"
    for lesson_id in lessons:
        safe_id = lesson_id.replace("::", "__").replace("/", "_").replace(" ", "_").replace(":", "_")
        path = os.path.join(sections_dir, f"{safe_id}_sections.json")
        if os.path.exists(path):
            try:
                os.remove(path)
            except Exception:
                pass

    ok, msg = delete_course(db, course_id, current_user["username"])
    if not ok:
        raise HTTPException(status_code=404, detail=msg)
    return {"message": msg, "course_id": course_id}