import json
import os

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


def create_course(course_name: str, teacher_username: str):
    courses = load_courses()

    course_id = f"{teacher_username}::{course_name.strip().lower()}"
    if course_id in courses:
        return False, "This course already exists."

    courses[course_id] = {
        "course_id": course_id,
        "course_name": course_name.strip(),
        "teacher_username": teacher_username,
        "materials": []
    }

    save_courses(courses)
    return True, course_id


def add_material_to_course(course_id: str, filename: str, text_content: str):
    courses = load_courses()
    if course_id not in courses:
        return False, "Course not found."

    safe_course_id = course_id.replace("::", "__").replace("/", "_")
    material_index = len(courses[course_id]["materials"]) + 1
    material_filename = f"{safe_course_id}_{material_index}.txt"
    material_path = os.path.join(COURSE_MATERIALS_DIR, material_filename)

    with open(material_path, "w", encoding="utf-8") as f:
        f.write(text_content)

    courses[course_id]["materials"].append({
        "original_filename": filename,
        "stored_path": material_path
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


def get_course_materials_text(course_id: str):
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
                all_text.append(
                    f"\n\n--- {material['original_filename']} ---\n{text}"
                )

    return "".join(all_text)


def get_course_display_options():
    courses = load_courses()
    options = {}
    for course_id, course_data in courses.items():
        label = f"{course_data['course_name']} — {course_data['teacher_username']}"
        options[label] = course_id
    return options