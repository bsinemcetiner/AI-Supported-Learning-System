import json
import os
import hashlib
from datetime import datetime

COURSES_FILE = "courses.json"
COURSE_MATERIALS_DIR = "course_materials"


def _ensure_storage():
    if not os.path.exists(COURSES_FILE):
        with open(COURSES_FILE, "w", encoding="utf-8") as f:
            json.dump({}, f, ensure_ascii=False, indent=4)

    if not os.path.exists(COURSE_MATERIALS_DIR):
        os.makedirs(COURSE_MATERIALS_DIR)


def load_courses():
    _ensure_storage()
    with open(COURSES_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def save_courses(courses):
    with open(COURSES_FILE, "w", encoding="utf-8") as f:
        json.dump(courses, f, ensure_ascii=False, indent=4)


def _hash_text(text: str) -> str:
    return hashlib.md5(text.encode("utf-8")).hexdigest()


def create_course(course_name: str, teacher_username: str):
    courses = load_courses()

    clean_name = course_name.strip()
    if not clean_name:
        return False, "Course name cannot be empty."

    course_id = f"{teacher_username}::{clean_name.lower()}"
    if course_id in courses:
        return False, "This course already exists."

    courses[course_id] = {
        "course_id": course_id,
        "course_name": clean_name,
        "teacher_username": teacher_username,
        "materials": [],
        "created_at": datetime.now().isoformat()
    }

    save_courses(courses)
    return True, course_id


def add_material_to_course(course_id: str, filename: str, text_content: str):
    """
    Adds a material to the course only if it is not already present
    based on text hash.
    """
    courses = load_courses()

    if course_id not in courses:
        return False, "Course not found."

    clean_text = text_content.strip()
    if not clean_text:
        return False, "Material content is empty."

    file_hash = _hash_text(clean_text)
    existing_materials = courses[course_id].get("materials", [])

    for material in existing_materials:
        if material.get("file_hash") == file_hash:
            return False, "This material already exists in the selected course."

    safe_course_id = course_id.replace("::", "__").replace("/", "_")
    material_index = len(existing_materials) + 1
    material_filename = f"{safe_course_id}_{material_index}.txt"
    material_path = os.path.join(COURSE_MATERIALS_DIR, material_filename)

    with open(material_path, "w", encoding="utf-8") as f:
        f.write(clean_text)

    courses[course_id]["materials"].append({
        "original_filename": filename,
        "stored_path": material_path,
        "file_hash": file_hash,
        "uploaded_at": datetime.now().isoformat()
    })

    save_courses(courses)
    return True, "Material added successfully."


def get_teacher_courses(teacher_username: str):
    courses = load_courses()
    return {
        cid: cdata
        for cid, cdata in courses.items()
        if cdata["teacher_username"] == teacher_username
    }


def get_all_courses():
    return load_courses()


def get_course_by_id(course_id: str):
    courses = load_courses()
    return courses.get(course_id)


def get_course_materials(course_id: str):
    courses = load_courses()
    if course_id not in courses:
        return []
    return courses[course_id].get("materials", [])


def get_course_materials_text(course_id: str):
    """
    Still available for compatibility, but later we should reduce reliance on this
    and use RAG retrieval instead of dumping all raw text into chat state.
    """
    courses = load_courses()
    if course_id not in courses:
        return ""

    materials = courses[course_id].get("materials", [])
    all_text = []

    for material in materials:
        path = material.get("stored_path")
        if path and os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f:
                text = f.read()
                all_text.append(f"\n\n--- {material['original_filename']} ---\n{text}")

    return "".join(all_text)


def get_course_display_options():
    courses = load_courses()
    options = {}
    for course_id, course_data in courses.items():
        label = f"{course_data['course_name']} — {course_data['teacher_username']}"
        options[label] = course_id
    return options


def delete_material_from_course(course_id: str, stored_path: str):
    """
    Deletes a material record from the course and removes the stored text file if it exists.
    Returns (success, message, removed_material or None)
    """
    courses = load_courses()

    if course_id not in courses:
        return False, "Course not found.", None

    materials = courses[course_id].get("materials", [])
    target = None

    for material in materials:
        if material.get("stored_path") == stored_path:
            target = material
            break

    if not target:
        return False, "Material not found.", None

    path = target.get("stored_path")
    if path and os.path.exists(path):
        try:
            os.remove(path)
        except Exception as e:
            pass # Dosya zaten silinmişse hatayı görmezden gel ve JSON'dan temizlemeye devam et

    courses[course_id]["materials"] = [
        m for m in materials if m.get("stored_path") != stored_path
    ]

    save_courses(courses)
    return True, "Material deleted successfully.", target