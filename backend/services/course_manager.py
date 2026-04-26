import os
import hashlib
from datetime import datetime
from sqlalchemy.orm import Session

from models import Course, CourseMaterial

COURSE_MATERIALS_DIR = "course_materials"


def _ensure_storage():
    if not os.path.exists(COURSE_MATERIALS_DIR):
        os.makedirs(COURSE_MATERIALS_DIR)


def _hash_text(text: str) -> str:
    return hashlib.md5(text.encode("utf-8")).hexdigest()


def create_course(db: Session, course_name: str, teacher_username: str):
    clean_name = course_name.strip()
    if not clean_name:
        return False, "Course name cannot be empty."

    course_id = f"{teacher_username}::{clean_name.lower()}"

    existing = db.query(Course).filter(Course.course_id == course_id).first()
    if existing:
        return False, "This course already exists."

    course = Course(
        course_id=course_id,
        course_name=clean_name,
        teacher_username=teacher_username,
        created_at=datetime.utcnow(),
    )
    db.add(course)
    db.commit()
    db.refresh(course)

    return True, course_id


def add_material_to_course(db: Session, course_id: str, filename: str, text_content: str, pdf_path: str = None):
    _ensure_storage()

    course = db.query(Course).filter(Course.course_id == course_id).first()
    if not course:
        return False, "Course not found."

    clean_text = text_content.strip()
    if not clean_text:
        return False, "Material content is empty."

    file_hash = _hash_text(clean_text)

    existing_materials = db.query(CourseMaterial).filter(CourseMaterial.course_id == course_id).all()
    for material in existing_materials:
        if material.original_filename.strip().lower() == filename.strip().lower():
            return False, "A file with the same name already exists in this course."
        if material.file_hash == file_hash:
            return False, "A file with the same content already exists in this course."

    safe_course_id = course_id.replace("::", "__").replace("/", "_")
    material_index = len(existing_materials) + 1
    material_filename = f"{safe_course_id}_{material_index}.txt"
    material_path = os.path.join(COURSE_MATERIALS_DIR, material_filename)

    with open(material_path, "w", encoding="utf-8") as f:
        f.write(clean_text)

    material = CourseMaterial(
        course_id=course_id,
        original_filename=filename,
        stored_path=material_path,
        pdf_path=pdf_path,
        file_hash=file_hash,
        uploaded_at=datetime.utcnow(),
    )
    db.add(material)
    db.commit()

    return True, "Material added successfully."


def get_teacher_courses(db: Session, teacher_username: str):
    courses = db.query(Course).filter(Course.teacher_username == teacher_username).all()
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


def get_all_courses(db: Session):
    courses = db.query(Course).all()
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


def get_course_by_id(db: Session, course_id: str):
    course = db.query(Course).filter(Course.course_id == course_id).first()
    if not course:
        return None

    materials = db.query(CourseMaterial).filter(CourseMaterial.course_id == course_id).all()
    return {
        "course_id": course.course_id,
        "course_name": course.course_name,
        "teacher_username": course.teacher_username,
        "created_at": course.created_at.isoformat() if course.created_at else None,
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


def get_course_materials(db: Session, course_id: str):
    materials = db.query(CourseMaterial).filter(CourseMaterial.course_id == course_id).all()
    return [
        {
            "original_filename": m.original_filename,
            "stored_path": m.stored_path,
            "file_hash": m.file_hash,
            "uploaded_at": m.uploaded_at.isoformat() if m.uploaded_at else None,
        }
        for m in materials
    ]


def get_course_materials_text(db: Session, course_id: str):
    materials = db.query(CourseMaterial).filter(CourseMaterial.course_id == course_id).all()
    all_text = []

    for material in materials:
        path = material.stored_path
        if path and os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f:
                text = f.read()
                all_text.append(f"\n\n--- {material.original_filename} ---\n{text}")

    return "".join(all_text)


def get_course_display_options(db: Session):
    courses = db.query(Course).all()
    return {
        f"{course.course_name} — {course.teacher_username}": course.course_id
        for course in courses
    }


def delete_material_from_course(db: Session, course_id: str, file_hash: str):
    material = db.query(CourseMaterial).filter(
        CourseMaterial.course_id == course_id,
        CourseMaterial.file_hash == file_hash
    ).first()

    if not material:
        return False, "Material not found.", None

    removed = {
        "original_filename": material.original_filename,
        "stored_path": material.stored_path,
        "file_hash": material.file_hash,
        "uploaded_at": material.uploaded_at.isoformat() if material.uploaded_at else None,
    }

    if material.stored_path and os.path.exists(material.stored_path):
        try:
            os.remove(material.stored_path)
        except Exception as e:
            return False, f"Could not delete stored file: {e}", None

    db.delete(material)
    db.commit()

    return True, "Material deleted successfully.", removed