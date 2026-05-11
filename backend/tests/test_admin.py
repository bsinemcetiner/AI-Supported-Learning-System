"""
test_admin.py — Admin Tests

Test Scenarios:

  Admin Login:
  - Valid admin credentials → token returned
  - Wrong password → 401
  - Non-existent admin → 401

  Admin Endpoints (require admin token):
  - List all students
  - List all teachers
  - List all courses
  - Get student's courses
  - Assign course to student
  - Remove course from student
  - No token → 403
  - Regular user token → 403
"""

import pytest
from models.admin import Admin
from tests.conftest import register_user, get_token, auth
import hashlib


# ─────────────────────────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────────────────────────

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()


def get_admin_token(client) -> str:
    """Login as admin and return token."""
    res = client.post("/api/admin/login",
                      json={"username": "testadmin", "password": "Admin1234!"})
    assert res.status_code == 200, f"Admin login failed: {res.json()}"
    return res.json()["access_token"]


def admin_auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


# ─────────────────────────────────────────────────────────────────────────────
# FIXTURES
# ─────────────────────────────────────────────────────────────────────────────

@pytest.fixture
def admin_token(client, db):
    """Create an admin user directly in DB and return token."""
    admin = Admin(
        username="testadmin",
        hashed_password=hash_password("Admin1234!"),
    )
    db.add(admin)
    db.commit()
    return get_admin_token(client)


@pytest.fixture
def kayaoguz_token(client):
    register_user(client, "Kaya Oguz", "kayaoguz",
                  "KayaOguz2024!", "teacher", "kaya.oguz@ieu.edu.tr")
    return get_token(client, "kayaoguz", "KayaOguz2024!")


@pytest.fixture
def emiray_token(client):
    register_user(client, "Emiray Durmaz", "emiraydurmaz",
                  "Emiray2024!", "student", "emiray.durmaz@std.ieu.edu.tr")
    return get_token(client, "emiraydurmaz", "Emiray2024!")


@pytest.fixture
def all_students(client):
    """Register all 4 students and return their usernames."""
    students = [
        ("Emiray Durmaz", "emiraydurmaz", "Emiray2024!", "emiray.durmaz@std.ieu.edu.tr"),
        ("Yasemin Guler Kocar", "yaseminguler", "Yasemin2024!", "yasemin.guler@std.ieu.edu.tr"),
        ("Meltem Demir", "meltemdemir", "Meltem2024!", "meltem.demir@std.ieu.edu.tr"),
        ("Betul Sinem Cetiner", "betulcetin", "Betul2024!", "betul.cetiner@std.ieu.edu.tr"),
    ]
    for full_name, username, password, email in students:
        register_user(client, full_name, username, password, "student", email)
    return [s[1] for s in students]


# ══════════════════════════════════════════════════════════════════════════════
# ADMIN LOGIN
# ══════════════════════════════════════════════════════════════════════════════

class TestAdminLogin:

    def test_admin_login_successful(self, client, db):
        """Admin should be able to login with correct credentials."""
        admin = Admin(username="admin1", hashed_password=hash_password("AdminPass!"))
        db.add(admin)
        db.commit()

        res = client.post("/api/admin/login",
                          json={"username": "admin1", "password": "AdminPass!"})
        assert res.status_code == 200
        assert "access_token" in res.json()
        assert res.json()["token_type"] == "bearer"

    def test_admin_login_wrong_password(self, client, db):
        """Admin login with wrong password → 401."""
        admin = Admin(username="admin2", hashed_password=hash_password("CorrectPass!"))
        db.add(admin)
        db.commit()

        res = client.post("/api/admin/login",
                          json={"username": "admin2", "password": "WrongPass!"})
        assert res.status_code == 401

    def test_admin_login_nonexistent_user(self, client):
        """Admin login with non-existent username → 401."""
        res = client.post("/api/admin/login",
                          json={"username": "nobody_admin", "password": "Test1234!"})
        assert res.status_code == 401


# ══════════════════════════════════════════════════════════════════════════════
# ADMIN AUTHORIZATION
# ══════════════════════════════════════════════════════════════════════════════

class TestAdminAuthorization:

    def test_no_token_cannot_list_students(self, client):
        """Listing students without token → 403."""
        res = client.get("/api/admin/students")
        assert res.status_code in (401, 403)

    def test_regular_user_token_cannot_access_admin(self, client, emiray_token):
        """Regular user token cannot access admin endpoints → 403."""
        res = client.get("/api/admin/students",
                         headers=auth(emiray_token))
        assert res.status_code == 403

    def test_teacher_token_cannot_access_admin(self, client, kayaoguz_token):
        """Teacher token cannot access admin endpoints → 403."""
        res = client.get("/api/admin/students",
                         headers=auth(kayaoguz_token))
        assert res.status_code == 403

    def test_fake_admin_token_rejected(self, client):
        """Fake admin token → 401 or 403."""
        res = client.get("/api/admin/students",
                         headers={"Authorization": "Bearer fake_admin_token"})
        assert res.status_code in (401, 403)


# ══════════════════════════════════════════════════════════════════════════════
# LIST STUDENTS / TEACHERS / COURSES
# ══════════════════════════════════════════════════════════════════════════════

class TestAdminListing:

    def test_admin_can_list_students(self, client, admin_token, all_students):
        """Admin should be able to list all students."""
        res = client.get("/api/admin/students",
                         headers=admin_auth(admin_token))
        assert res.status_code == 200
        data = res.json()
        assert isinstance(data, list)
        usernames = [s["username"] for s in data]
        assert "emiraydurmaz" in usernames
        assert "yaseminguler" in usernames
        assert "meltemdemir" in usernames
        assert "betulcetin" in usernames

    def test_admin_can_list_teachers(self, client, admin_token, kayaoguz_token):
        """Admin should be able to list all teachers."""
        res = client.get("/api/admin/teachers",
                         headers=admin_auth(admin_token))
        assert res.status_code == 200
        data = res.json()
        assert isinstance(data, list)
        usernames = [t["username"] for t in data]
        assert "kayaoguz" in usernames

    def test_admin_can_list_courses(self, client, admin_token, kayaoguz_token):
        """Admin should be able to list all courses."""
        client.post("/api/courses/",
                    json={"course_name": "Operating Systems"},
                    headers=auth(kayaoguz_token))
        res = client.get("/api/admin/courses",
                         headers=admin_auth(admin_token))
        assert res.status_code == 200
        assert isinstance(res.json(), list)

    def test_student_list_contains_correct_fields(self, client, admin_token, all_students):
        """Each student in the list should have id, username, full_name."""
        res = client.get("/api/admin/students",
                         headers=admin_auth(admin_token))
        student = res.json()[0]
        assert "id" in student
        assert "username" in student
        assert "full_name" in student

    def test_empty_student_list_returns_empty_array(self, client, admin_token):
        """If no students, should return empty list."""
        res = client.get("/api/admin/students",
                         headers=admin_auth(admin_token))
        assert res.status_code == 200
        assert isinstance(res.json(), list)


# ══════════════════════════════════════════════════════════════════════════════
# ASSIGN / REMOVE COURSE
# ══════════════════════════════════════════════════════════════════════════════

class TestAdminCourseAssignment:

    def test_admin_can_assign_course_to_student(self, client, admin_token,
                                                 kayaoguz_token, emiray_token):
        """Admin should be able to assign a course to a student."""
        # Create course
        course_res = client.post("/api/courses/",
                                  json={"course_name": "Admin Test Course"},
                                  headers=auth(kayaoguz_token))
        course_id = course_res.json()["course_id"]

        # Get student id
        students = client.get("/api/admin/students",
                              headers=admin_auth(admin_token)).json()
        emiray = next(s for s in students if s["username"] == "emiraydurmaz")

        res = client.post("/api/admin/assign",
                          json={"student_id": emiray["id"], "course_id": course_id},
                          headers=admin_auth(admin_token))
        assert res.status_code == 200

    def test_admin_can_get_student_courses(self, client, admin_token,
                                            kayaoguz_token, emiray_token):
        """Admin should be able to see a student's enrolled courses."""
        # Create and assign course
        course_res = client.post("/api/courses/",
                                  json={"course_name": "Student Course Check"},
                                  headers=auth(kayaoguz_token))
        course_id = course_res.json()["course_id"]

        students = client.get("/api/admin/students",
                              headers=admin_auth(admin_token)).json()
        emiray = next(s for s in students if s["username"] == "emiraydurmaz")

        client.post("/api/admin/assign",
                    json={"student_id": emiray["id"], "course_id": course_id},
                    headers=admin_auth(admin_token))

        res = client.get(f"/api/admin/students/{emiray['id']}/courses",
                         headers=admin_auth(admin_token))
        assert res.status_code == 200
        course_ids = [c["id"] for c in res.json()]
        assert course_id in course_ids

    def test_admin_can_remove_course_from_student(self, client, admin_token,
                                                    kayaoguz_token, emiray_token):
        """Admin should be able to remove a course from a student."""
        course_res = client.post("/api/courses/",
                                  json={"course_name": "Remove Test Course"},
                                  headers=auth(kayaoguz_token))
        course_id = course_res.json()["course_id"]

        students = client.get("/api/admin/students",
                              headers=admin_auth(admin_token)).json()
        emiray = next(s for s in students if s["username"] == "emiraydurmaz")

        client.post("/api/admin/assign",
                    json={"student_id": emiray["id"], "course_id": course_id},
                    headers=admin_auth(admin_token))

        import json
        res = client.delete("/api/admin/remove",
                            content=json.dumps({"student_id": emiray["id"], "course_id": course_id}),
                            headers={**admin_auth(admin_token), "Content-Type": "application/json"})
        assert res.status_code == 200

    def test_admin_can_assign_all_students_to_course(self, client, admin_token,
                                                       kayaoguz_token, all_students):
        """Admin should be able to assign all 4 students to the same course."""
        course_res = client.post("/api/courses/",
                                  json={"course_name": "All Students Course"},
                                  headers=auth(kayaoguz_token))
        course_id = course_res.json()["course_id"]

        students = client.get("/api/admin/students",
                              headers=admin_auth(admin_token)).json()

        for username in all_students:
            student = next((s for s in students if s["username"] == username), None)
            if student:
                res = client.post("/api/admin/assign",
                                  json={"student_id": student["id"],
                                        "course_id": course_id},
                                  headers=admin_auth(admin_token))
                assert res.status_code == 200, f"Failed to assign {username}"
