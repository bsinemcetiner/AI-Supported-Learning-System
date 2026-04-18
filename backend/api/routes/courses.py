from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel
from pypdf import PdfReader
import io

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

router = APIRouter(prefix="/courses", tags=["courses"])
rag = RAGManager()


def _read_pdf_bytes(file_bytes: bytes) -> str:
    try:
        reader = PdfReader(io.BytesIO(file_bytes))
        return "\n".join(
            p.extract_text() for p in reader.pages if p.extract_text()
        ).strip()
    except Exception:
        return ""


class CreateCourseRequest(BaseModel):
    course_name: str


# ── GET /courses ── tüm kurslar (öğrenci için)
@router.get("/")
def list_all_courses(
    _: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return get_all_courses(db)


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


# ── POST /courses/{course_id}/materials ── PDF yükle
@router.post("/{course_id}/materials", status_code=201)
async def upload_material(
    course_id: str,
    file: UploadFile = File(...),
    current_user: dict = Depends(require_teacher),
    db: Session = Depends(get_db)
):
    content = await file.read()
    text = _read_pdf_bytes(content)

    if not text:
        raise HTTPException(status_code=422, detail=f"{file.filename}: could not extract text")

    add_ok, add_msg = add_material_to_course(
        db=db,
        course_id=course_id,
        filename=file.filename,
        text_content=text,
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