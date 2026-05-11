"""
test_notifications.py — Notification Tests

Test Scenarios:

  Get Notifications (/notifications/):
  - Emiray gets notifications for her enrolled courses
  - Kaya Oguz gets notifications for his own courses
  - User with no courses gets empty notifications
  - No token rejected → 401
  - Notifications contain correct fields
  - Unread count is correct

  Mark Single as Read (/notifications/{id}/read):
  - Emiray can mark a notification as read
  - Marking already-read notification is idempotent
  - Unread count decreases after marking as read

  Mark All as Read (/notifications/read-all):
  - Emiray can mark all notifications as read
  - Unread count becomes 0 after mark-all-read

  Send Notification (/notifications/) — teacher only:
  - Kaya Oguz can send an announcement
  - Student cannot send a notification → 403
  - No token cannot send → 401
"""

import pytest
from tests.conftest import register_user, get_token, auth
from models.notification import Notification


# ─────────────────────────────────────────────────────────────────────────────
# FIXTURES
# ─────────────────────────────────────────────────────────────────────────────

@pytest.fixture
def emiray_token(client):
    register_user(client, "Emiray Durmaz", "emiraydurmaz",
                  "Emiray2024!", "student", "emiray.durmaz@std.ieu.edu.tr")
    return get_token(client, "emiraydurmaz", "Emiray2024!")


@pytest.fixture
def yasemin_token(client):
    register_user(client, "Yasemin Guler Kocar", "yaseminguler",
                  "Yasemin2024!", "student", "yasemin.guler@std.ieu.edu.tr")
    return get_token(client, "yaseminguler", "Yasemin2024!")


@pytest.fixture
def meltem_token(client):
    register_user(client, "Meltem Demir", "meltemdemir",
                  "Meltem2024!", "student", "meltem.demir@std.ieu.edu.tr")
    return get_token(client, "meltemdemir", "Meltem2024!")


@pytest.fixture
def betul_token(client):
    register_user(client, "Betul Sinem Cetiner", "betulcetin",
                  "Betul2024!", "student", "betul.cetiner@std.ieu.edu.tr")
    return get_token(client, "betulcetin", "Betul2024!")


@pytest.fixture
def kayaoguz_token(client):
    register_user(client, "Kaya Oguz", "kayaoguz",
                  "KayaOguz2024!", "teacher", "kaya.oguz@ieu.edu.tr")
    return get_token(client, "kayaoguz", "KayaOguz2024!")


@pytest.fixture
def course_id(client, kayaoguz_token):
    """A course created by Kaya Oguz."""
    res = client.post("/api/courses/",
                      json={"course_name": "Operating Systems"},
                      headers=auth(kayaoguz_token))
    assert res.status_code == 201
    return res.json()["course_id"]


def create_notification(client, kayaoguz_token, course_id,
                        title="Test Notification",
                        message="This is a test message.") -> dict:
    """Helper: Kaya Oguz sends a notification to a course."""
    res = client.post("/api/notifications/",
                      json={"course_id": course_id,
                            "title": title,
                            "message": message,
                            "type": "announcement"},
                      headers=auth(kayaoguz_token))
    assert res.status_code == 201, f"Notification creation failed: {res.json()}"
    return res.json()


def enroll_student(client, student_token, course_id):
    """Helper: enroll a student in a course."""
    res = client.post(f"/api/courses/{course_id}/enroll",
                      headers=auth(student_token))
    assert res.status_code == 201


# ══════════════════════════════════════════════════════════════════════════════
# SEND NOTIFICATION (teacher only)
# ══════════════════════════════════════════════════════════════════════════════

class TestSendNotification:

    def test_kayaoguz_can_send_notification(self, client, kayaoguz_token, course_id):
        """Kaya Oguz should be able to send a notification to his course."""
        res = client.post("/api/notifications/",
                          json={"course_id": course_id,
                                "title": "New Assignment",
                                "message": "Please complete chapter 3.",
                                "type": "announcement"},
                          headers=auth(kayaoguz_token))
        assert res.status_code == 201
        data = res.json()
        assert data["title"] == "New Assignment"
        assert data["course_id"] == course_id
        assert data["created_by"] == "kayaoguz"

    def test_student_cannot_send_notification(self, client, emiray_token, course_id):
        """Student Emiray should not be able to send a notification → 403."""
        res = client.post("/api/notifications/",
                          json={"course_id": course_id,
                                "title": "Hacked",
                                "message": "I hacked this.",
                                "type": "announcement"},
                          headers=auth(emiray_token))
        assert res.status_code == 403

    def test_yasemin_cannot_send_notification(self, client, yasemin_token, course_id):
        """Student Yasemin should not be able to send a notification → 403."""
        res = client.post("/api/notifications/",
                          json={"course_id": course_id,
                                "title": "Unauthorized",
                                "message": "This should fail.",
                                "type": "announcement"},
                          headers=auth(yasemin_token))
        assert res.status_code == 403

    def test_no_token_cannot_send_notification(self, client, course_id):
        """Sending a notification without a token → 401."""
        res = client.post("/api/notifications/",
                          json={"course_id": course_id,
                                "title": "No Auth",
                                "message": "No token.",
                                "type": "announcement"})
        assert res.status_code == 401


# ══════════════════════════════════════════════════════════════════════════════
# GET NOTIFICATIONS
# ══════════════════════════════════════════════════════════════════════════════

class TestGetNotifications:

    def test_emiray_gets_notifications_for_enrolled_course(
            self, client, kayaoguz_token, emiray_token, course_id):
        """Emiray should see notifications for courses she is enrolled in."""
        enroll_student(client, emiray_token, course_id)
        create_notification(client, kayaoguz_token, course_id,
                            title="Welcome!", message="Welcome to OS course.")

        res = client.get("/api/notifications/", headers=auth(emiray_token))
        assert res.status_code == 200
        data = res.json()
        assert "notifications" in data
        assert "unread_count" in data
        titles = [n["title"] for n in data["notifications"]]
        assert "Welcome!" in titles

    def test_all_enrolled_students_see_notification(
            self, client, kayaoguz_token, emiray_token, yasemin_token,
            meltem_token, betul_token, course_id):
        """All 4 enrolled students should see the course notification."""
        for token in [emiray_token, yasemin_token, meltem_token, betul_token]:
            enroll_student(client, token, course_id)

        create_notification(client, kayaoguz_token, course_id,
                            title="Exam Date", message="Exam is on Friday.")

        for token, name in [
            (emiray_token, "Emiray"),
            (yasemin_token, "Yasemin"),
            (meltem_token, "Meltem"),
            (betul_token, "Betul"),
        ]:
            res = client.get("/api/notifications/", headers=auth(token))
            assert res.status_code == 200
            titles = [n["title"] for n in res.json()["notifications"]]
            assert "Exam Date" in titles, f"{name} should see the notification"

    def test_kayaoguz_sees_struggle_alert_notifications(
            self, client, kayaoguz_token, db):
        """
        Kaya Oguz should see notifications with target_role='teacher'.
        NOTE: send_notification endpoint always sets target_role='student'.
        Teachers see notifications via target_role='teacher' (e.g. struggle_alerts).
        We inject a teacher-targeted notification directly to test this.
        """
        from models.course import Course
        from datetime import datetime

        # Inject course directly into DB
        course = Course(
            course_id="kayaoguz::teacher_notif_course",
            course_name="Teacher Notif Course",
            teacher_username="kayaoguz",
            created_at=datetime.utcnow(),
        )
        db.add(course)
        db.flush()

        # Inject a teacher-targeted notification (e.g. struggle_alert)
        notif = Notification(
            course_id="kayaoguz::teacher_notif_course",
            title="Students struggling: Section 1",
            message="5 confusion questions detected.",
            type="struggle_alert",
            created_by="system",
            target_role="teacher",
        )
        db.add(notif)
        db.commit()

        # Teacher should see this notification
        res = client.get("/api/notifications/", headers=auth(kayaoguz_token))
        assert res.status_code == 200
        titles = [n["title"] for n in res.json()["notifications"]]
        assert "Students struggling: Section 1" in titles

    def test_teacher_cannot_see_student_targeted_notifications(
            self, client, kayaoguz_token, db):
        """
        Notifications sent via send_notification endpoint have target_role='student'.
        Teacher should NOT see these — they are for students only.
        This is by design, not a bug.
        """
        from models.course import Course
        from datetime import datetime

        course = Course(
            course_id="kayaoguz::design_test_course",
            course_name="Design Test Course",
            teacher_username="kayaoguz",
            created_at=datetime.utcnow(),
        )
        db.add(course)
        db.flush()

        # Student-targeted notification (what send_notification creates)
        notif = Notification(
            course_id="kayaoguz::design_test_course",
            title="New Announcement",
            message="Check the new material.",
            type="announcement",
            created_by="kayaoguz",
            target_role="student",
        )
        db.add(notif)
        db.commit()

        res = client.get("/api/notifications/", headers=auth(kayaoguz_token))
        assert res.status_code == 200
        titles = [n["title"] for n in res.json()["notifications"]]
        # Teacher should NOT see student-targeted notifications
        assert "New Announcement" not in titles

    def test_unenrolled_student_does_not_see_notification(
            self, client, kayaoguz_token, emiray_token, course_id):
        """Emiray not enrolled in the course should not see its notifications."""
        create_notification(client, kayaoguz_token, course_id,
                            title="Secret Announcement", message="Only enrolled.")
        res = client.get("/api/notifications/", headers=auth(emiray_token))
        titles = [n["title"] for n in res.json()["notifications"]]
        assert "Secret Announcement" not in titles

    def test_no_courses_returns_empty(self, client, betul_token):
        """Betul with no enrolled courses should get empty notifications."""
        res = client.get("/api/notifications/", headers=auth(betul_token))
        assert res.status_code == 200
        assert res.json()["notifications"] == []
        assert res.json()["unread_count"] == 0

    def test_no_token_cannot_get_notifications(self, client):
        """Getting notifications without a token → 401."""
        res = client.get("/api/notifications/")
        assert res.status_code == 401

    def test_notification_contains_correct_fields(
            self, client, kayaoguz_token, emiray_token, course_id):
        """Each notification should have the expected fields."""
        enroll_student(client, emiray_token, course_id)
        create_notification(client, kayaoguz_token, course_id)
        res = client.get("/api/notifications/", headers=auth(emiray_token))
        notif = res.json()["notifications"][0]
        assert "id" in notif
        assert "title" in notif
        assert "message" in notif
        assert "course_id" in notif
        assert "type" in notif
        assert "is_read" in notif
        assert "created_by" in notif

    def test_new_notification_is_unread(
            self, client, kayaoguz_token, emiray_token, course_id):
        """A newly created notification should be unread."""
        enroll_student(client, emiray_token, course_id)
        create_notification(client, kayaoguz_token, course_id, title="Unread Test")
        res = client.get("/api/notifications/", headers=auth(emiray_token))
        notifs = res.json()["notifications"]
        unread = [n for n in notifs if n["title"] == "Unread Test"]
        assert len(unread) == 1
        assert unread[0]["is_read"] is False
        assert res.json()["unread_count"] >= 1


# ══════════════════════════════════════════════════════════════════════════════
# MARK AS READ
# ══════════════════════════════════════════════════════════════════════════════

class TestMarkAsRead:

    def test_emiray_can_mark_notification_as_read(
            self, client, kayaoguz_token, emiray_token, course_id):
        """Emiray should be able to mark a notification as read."""
        enroll_student(client, emiray_token, course_id)
        notif = create_notification(client, kayaoguz_token, course_id,
                                    title="Mark Read Test")
        notif_id = notif["id"]

        res = client.patch(f"/api/notifications/{notif_id}/read",
                           headers=auth(emiray_token))
        assert res.status_code == 200
        assert res.json()["ok"] is True

        # Verify it's now read
        notifications = client.get("/api/notifications/",
                                   headers=auth(emiray_token)).json()["notifications"]
        read_notif = next((n for n in notifications if n["id"] == notif_id), None)
        assert read_notif is not None
        assert read_notif["is_read"] is True

    def test_marking_already_read_is_idempotent(
            self, client, kayaoguz_token, emiray_token, course_id):
        """Marking an already-read notification again should not cause errors."""
        enroll_student(client, emiray_token, course_id)
        notif = create_notification(client, kayaoguz_token, course_id)
        notif_id = notif["id"]

        client.patch(f"/api/notifications/{notif_id}/read", headers=auth(emiray_token))
        res = client.patch(f"/api/notifications/{notif_id}/read", headers=auth(emiray_token))
        assert res.status_code == 200

    def test_unread_count_decreases_after_mark_read(
            self, client, kayaoguz_token, yasemin_token, course_id):
        """Unread count should decrease after marking a notification as read."""
        enroll_student(client, yasemin_token, course_id)
        notif = create_notification(client, kayaoguz_token, course_id,
                                    title="Count Test")

        before = client.get("/api/notifications/",
                            headers=auth(yasemin_token)).json()["unread_count"]

        client.patch(f"/api/notifications/{notif['id']}/read",
                     headers=auth(yasemin_token))

        after = client.get("/api/notifications/",
                           headers=auth(yasemin_token)).json()["unread_count"]

        assert after < before

    def test_no_token_cannot_mark_as_read(self, client):
        """Marking as read without a token → 401."""
        res = client.patch("/api/notifications/1/read")
        assert res.status_code == 401


# ══════════════════════════════════════════════════════════════════════════════
# MARK ALL AS READ
# ══════════════════════════════════════════════════════════════════════════════

class TestMarkAllRead:

    def test_emiray_can_mark_all_as_read(
            self, client, kayaoguz_token, emiray_token, course_id):
        """Emiray should be able to mark all notifications as read."""
        enroll_student(client, emiray_token, course_id)
        create_notification(client, kayaoguz_token, course_id, title="Notif 1")
        create_notification(client, kayaoguz_token, course_id, title="Notif 2")
        create_notification(client, kayaoguz_token, course_id, title="Notif 3")

        res = client.patch("/api/notifications/read-all",
                           headers=auth(emiray_token))
        assert res.status_code == 200
        assert res.json()["ok"] is True

        # Unread count should be 0
        data = client.get("/api/notifications/",
                          headers=auth(emiray_token)).json()
        assert data["unread_count"] == 0

    def test_all_students_can_mark_all_as_read(
            self, client, kayaoguz_token, emiray_token, yasemin_token,
            meltem_token, betul_token, course_id):
        """All 4 students should be able to mark all notifications as read."""
        for token in [emiray_token, yasemin_token, meltem_token, betul_token]:
            enroll_student(client, token, course_id)

        create_notification(client, kayaoguz_token, course_id, title="Shared Notif")

        for token, name in [
            (emiray_token, "Emiray"),
            (yasemin_token, "Yasemin"),
            (meltem_token, "Meltem"),
            (betul_token, "Betul"),
        ]:
            res = client.patch("/api/notifications/read-all", headers=auth(token))
            assert res.status_code == 200, f"{name} failed to mark all as read"

            count = client.get("/api/notifications/",
                               headers=auth(token)).json()["unread_count"]
            assert count == 0, f"{name} still has unread notifications"

    def test_no_token_cannot_mark_all_as_read(self, client):
        """Marking all as read without a token → 401."""
        res = client.patch("/api/notifications/read-all")
        assert res.status_code == 401
