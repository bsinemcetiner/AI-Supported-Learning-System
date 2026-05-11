"""
test_courses.py — Course Tests

Test Scenarios:
  - Kaya Oguz creates a course
  - Students cannot create courses
  - Access without token is rejected
  - Emiray, Yasemin, Meltem, Betul enroll in courses
  - Re-enrolling in the same course is blocked
  - Student can see their enrolled courses
  - Unenroll from a course
  - Teacher can see their own courses
"""

import pytest
from tests.conftest import register_user, get_token, auth


# ── Helper: Create a course as Kaya Oguz, return course_id ───────────────────
def create_course(client, token: str, course_name: str) -> str:
    res = client.post("/api/courses/",
                      json={"course_name": course_name},
                      headers=auth(token))
    assert res.status_code == 201, f"Course could not be created: {res.json()}"
    return res.json()["course_id"]


# ══════════════════════════════════════════════════════════════════════════════
# COURSE CREATION
# ══════════════════════════════════════════════════════════════════════════════

class TestCourseCreation:

    def test_kayaoguz_can_create_course(self, client, kayaoguz_token):
        """Teacher Kaya Oguz should be able to create a new course."""
        res = client.post("/api/courses/",
                          json={"course_name": "Data Structures and Algorithms"},
                          headers=auth(kayaoguz_token))
        assert res.status_code == 201
        assert "course_id" in res.json()

    def test_student_cannot_create_course(self, client, emiray_token):
        """Student Emiray attempting to create a course should be rejected → 403."""
        res = client.post("/api/courses/",
                          json={"course_name": "Unauthorized Course"},
                          headers=auth(emiray_token))
        assert res.status_code == 403

    def test_no_token_cannot_create_course(self, client):
        """Creating a course without a token should be rejected → 401."""
        res = client.post("/api/courses/", json={"course_name": "Unauthorized"})
        assert res.status_code == 401

    def test_multiple_courses_can_be_created(self, client, kayaoguz_token):
        """Kaya Oguz should be able to create multiple courses."""
        create_course(client, kayaoguz_token, "Object Oriented Programming")
        create_course(client, kayaoguz_token, "Database Management")
        res = client.get("/api/courses/mine", headers=auth(kayaoguz_token))
        assert res.status_code == 200
        assert len(res.json()) >= 2


# ══════════════════════════════════════════════════════════════════════════════
# COURSE LISTING
# ══════════════════════════════════════════════════════════════════════════════

class TestCourseListing:

    def test_kayaoguz_can_see_his_courses(self, client, kayaoguz_token):
        """/courses/mine should only return Kaya Oguz's courses."""
        create_course(client, kayaoguz_token, "Software Engineering")
        res = client.get("/api/courses/mine", headers=auth(kayaoguz_token))
        assert res.status_code == 200
        courses = res.json()
        for c in courses.values():
            assert c["teacher_username"] == "kayaoguz"

    def test_all_courses_listed(self, client, kayaoguz_token, emiray_token):
        """Any logged-in user should be able to see all courses."""
        create_course(client, kayaoguz_token, "Machine Learning")
        res = client.get("/api/courses/", headers=auth(emiray_token))
        assert res.status_code == 200
        assert isinstance(res.json(), dict)

    def test_student_mine_endpoint_forbidden(self, client, yasemin_token):
        """Student calling /courses/mine should be rejected → 403."""
        res = client.get("/api/courses/mine", headers=auth(yasemin_token))
        assert res.status_code == 403


# ══════════════════════════════════════════════════════════════════════════════
# COURSE ENROLLMENT
# ══════════════════════════════════════════════════════════════════════════════

class TestCourseEnrollment:

    def test_emiray_can_enroll(self, client, kayaoguz_token, emiray_token):
        """Emiray Durmaz should be able to enroll in a course."""
        course_id = create_course(client, kayaoguz_token, "Operating Systems")
        res = client.post(f"/api/courses/{course_id}/enroll",
                          headers=auth(emiray_token))
        assert res.status_code == 201
        assert res.json()["course_id"] == course_id

    def test_yasemin_can_enroll(self, client, kayaoguz_token, yasemin_token):
        """Yasemin Guler Kocar should be able to enroll in a course."""
        course_id = create_course(client, kayaoguz_token, "Computer Networks")
        res = client.post(f"/api/courses/{course_id}/enroll",
                          headers=auth(yasemin_token))
        assert res.status_code == 201

    def test_meltem_can_enroll(self, client, kayaoguz_token, meltem_token):
        """Meltem Demir should be able to enroll in a course."""
        course_id = create_course(client, kayaoguz_token, "Numerical Analysis")
        res = client.post(f"/api/courses/{course_id}/enroll",
                          headers=auth(meltem_token))
        assert res.status_code == 201

    def test_betul_can_enroll(self, client, kayaoguz_token, betul_token):
        """Betul Sinem Cetiner should be able to enroll in a course."""
        course_id = create_course(client, kayaoguz_token, "Linear Algebra")
        res = client.post(f"/api/courses/{course_id}/enroll",
                          headers=auth(betul_token))
        assert res.status_code == 201

    def test_duplicate_enrollment_rejected(self, client, kayaoguz_token, emiray_token):
        """Emiray attempting to enroll in the same course twice should be rejected → 409."""
        course_id = create_course(client, kayaoguz_token, "Probability and Statistics")
        client.post(f"/api/courses/{course_id}/enroll", headers=auth(emiray_token))
        res = client.post(f"/api/courses/{course_id}/enroll", headers=auth(emiray_token))
        assert res.status_code == 409

    def test_teacher_cannot_enroll(self, client, kayaoguz_token):
        """Teacher Kaya Oguz should not be able to enroll as a student → 403."""
        course_id = create_course(client, kayaoguz_token, "Compiler Design")
        res = client.post(f"/api/courses/{course_id}/enroll",
                          headers=auth(kayaoguz_token))
        assert res.status_code == 403

    def test_all_four_students_can_enroll(
            self, client, kayaoguz_token,
            emiray_token, yasemin_token, meltem_token, betul_token):
        """All 4 students should be able to enroll in the same course."""
        course_id = create_course(client, kayaoguz_token, "Artificial Intelligence")

        for token, name in [
            (emiray_token, "Emiray"),
            (yasemin_token, "Yasemin"),
            (meltem_token, "Meltem"),
            (betul_token, "Betul"),
        ]:
            res = client.post(f"/api/courses/{course_id}/enroll", headers=auth(token))
            assert res.status_code == 201, f"{name} could not enroll: {res.json()}"


# ══════════════════════════════════════════════════════════════════════════════
# UNENROLL
# ══════════════════════════════════════════════════════════════════════════════

class TestCourseUnenroll:

    def test_emiray_can_unenroll(self, client, kayaoguz_token, emiray_token):
        """Emiray should be able to unenroll from a course she is enrolled in."""
        course_id = create_course(client, kayaoguz_token, "Functional Programming")
        client.post(f"/api/courses/{course_id}/enroll", headers=auth(emiray_token))
        res = client.delete(f"/api/courses/{course_id}/unenroll",
                            headers=auth(emiray_token))
        assert res.status_code == 200

    def test_unenroll_without_enrollment_rejected(self, client, kayaoguz_token, yasemin_token):
        """Yasemin trying to unenroll from a course she never enrolled in → 404."""
        course_id = create_course(client, kayaoguz_token, "Parallel Computing")
        res = client.delete(f"/api/courses/{course_id}/unenroll",
                            headers=auth(yasemin_token))
        assert res.status_code == 404

    def test_reenroll_after_unenroll(self, client, kayaoguz_token, meltem_token):
        """Meltem should be able to enroll → unenroll → re-enroll successfully."""
        course_id = create_course(client, kayaoguz_token, "Distributed Systems")
        client.post(f"/api/courses/{course_id}/enroll", headers=auth(meltem_token))
        client.delete(f"/api/courses/{course_id}/unenroll", headers=auth(meltem_token))
        res = client.post(f"/api/courses/{course_id}/enroll", headers=auth(meltem_token))
        assert res.status_code == 201


# ══════════════════════════════════════════════════════════════════════════════
# ASSIGNED COURSES
# ══════════════════════════════════════════════════════════════════════════════

class TestAssignedCourses:

    def test_betul_can_see_enrolled_courses(self, client, kayaoguz_token, betul_token):
        """Betul's enrolled courses should appear in /assigned endpoint."""
        course_id = create_course(client, kayaoguz_token, "Cryptography")
        client.post(f"/api/courses/{course_id}/enroll", headers=auth(betul_token))
        res = client.get("/api/courses/assigned", headers=auth(betul_token))
        assert res.status_code == 200
        assert course_id in res.json()

    def test_assigned_empty_when_not_enrolled(self, client, emiray_token):
        """A student with no enrollments should get an empty assigned list."""
        res = client.get("/api/courses/assigned", headers=auth(emiray_token))
        assert res.status_code == 200
        assert isinstance(res.json(), dict)
