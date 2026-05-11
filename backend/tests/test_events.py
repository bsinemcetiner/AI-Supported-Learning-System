"""
test_events.py — Calendar Events Tests

Test Scenarios:

  Teacher Events (/events/):
  - Kaya Oguz can create an event
  - Student cannot create a teacher event → 403
  - Kaya Oguz can list his own events
  - Student cannot list teacher events → 403
  - Kaya Oguz can update his event
  - Cannot update someone else's event → 403
  - Kaya Oguz can delete his event
  - Cannot delete nonexistent event → 404
  - Cannot delete someone else's event → 403

  Shared Events (/events/shared):
  - Shared events are visible to everyone (teacher + students)
  - Non-shared events are not visible in shared list
  - All 4 students can see shared events

  Personal Student Events (/events/personal):
  - Emiray can create a personal event
  - Yasemin can create a personal event
  - Each student sees only their own personal events
  - Student can update their personal event
  - Student can delete their personal event
  - Cannot update another student's event → 403
"""

import pytest
from tests.conftest import register_user, get_token, auth


# ─────────────────────────────────────────────────────────────────────────────
# FIXTURES
# ─────────────────────────────────────────────────────────────────────────────

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


def create_teacher_event(client, token, title="Exam Week",
                         date="2026-06-01", shared=False) -> dict:
    res = client.post("/api/events/",
                      json={"title": title, "event_date": date,
                            "description": "Test event", "is_shared": shared},
                      headers=auth(token))
    assert res.status_code == 201, f"Event creation failed: {res.json()}"
    return res.json()


def create_personal_event(client, token, title="Study Session",
                          date="2026-06-01") -> dict:
    res = client.post("/api/events/personal",
                      json={"title": title, "event_date": date,
                            "description": "Personal event"},
                      headers=auth(token))
    assert res.status_code == 201, f"Personal event creation failed: {res.json()}"
    return res.json()


# ══════════════════════════════════════════════════════════════════════════════
# TEACHER EVENTS
# ══════════════════════════════════════════════════════════════════════════════

class TestTeacherEvents:

    def test_kayaoguz_can_create_event(self, client, kayaoguz_token):
        """Kaya Oguz should be able to create a calendar event."""
        res = client.post("/api/events/",
                          json={"title": "Midterm Exam",
                                "event_date": "2026-06-15",
                                "description": "Midterm exam for OS course",
                                "is_shared": False},
                          headers=auth(kayaoguz_token))
        assert res.status_code == 201
        data = res.json()
        assert data["title"] == "Midterm Exam"
        assert data["created_by"] == "kayaoguz"
        assert data["event_date"] == "2026-06-15"

    def test_student_cannot_create_teacher_event(self, client, emiray_token):
        """Student Emiray should not be able to create a teacher event → 403."""
        res = client.post("/api/events/",
                          json={"title": "Fake Event", "event_date": "2026-06-01"},
                          headers=auth(emiray_token))
        assert res.status_code == 403

    def test_all_students_cannot_create_teacher_events(
            self, client, emiray_token, yasemin_token, meltem_token, betul_token):
        """All 4 students should be blocked from creating teacher events."""
        for token, name in [(emiray_token, "Emiray"), (yasemin_token, "Yasemin"),
                             (meltem_token, "Meltem"), (betul_token, "Betul")]:
            res = client.post("/api/events/",
                              json={"title": f"{name} Fake", "event_date": "2026-06-01"},
                              headers=auth(token))
            assert res.status_code == 403, f"{name} should not create teacher events"

    def test_kayaoguz_can_list_his_events(self, client, kayaoguz_token):
        """Kaya Oguz should be able to list his own events."""
        create_teacher_event(client, kayaoguz_token, "Event 1", "2026-06-01")
        create_teacher_event(client, kayaoguz_token, "Event 2", "2026-06-02")
        res = client.get("/api/events/mine", headers=auth(kayaoguz_token))
        assert res.status_code == 200
        titles = [e["title"] for e in res.json()]
        assert "Event 1" in titles
        assert "Event 2" in titles

    def test_student_cannot_list_teacher_mine_events(self, client, emiray_token):
        """Student Emiray should not be able to access /events/mine → 403."""
        res = client.get("/api/events/mine", headers=auth(emiray_token))
        assert res.status_code == 403

    def test_kayaoguz_can_update_his_event(self, client, kayaoguz_token):
        """Kaya Oguz should be able to update his event."""
        event = create_teacher_event(client, kayaoguz_token, "Old Title", "2026-06-01")
        res = client.patch(f"/api/events/{event['id']}",
                           json={"title": "Updated Title"},
                           headers=auth(kayaoguz_token))
        assert res.status_code == 200
        assert res.json()["title"] == "Updated Title"

    def test_cannot_update_another_teachers_event(self, client, kayaoguz_token, db):
        """Cannot update an event created by someone else → 403."""
        from models.calendar_event import CalendarEvent
        from datetime import datetime
        other_event = CalendarEvent(
            title="Other Teacher Event", event_date="2026-06-01",
            created_by="other_teacher", is_shared=False,
            color="#3b82f6", created_at=datetime.utcnow()
        )
        db.add(other_event)
        db.commit()
        res = client.patch(f"/api/events/{other_event.id}",
                           json={"title": "Hacked"},
                           headers=auth(kayaoguz_token))
        assert res.status_code == 403

    def test_kayaoguz_can_delete_his_event(self, client, kayaoguz_token):
        """Kaya Oguz should be able to delete his event."""
        event = create_teacher_event(client, kayaoguz_token, "To Delete", "2026-06-01")
        res = client.delete(f"/api/events/{event['id']}",
                            headers=auth(kayaoguz_token))
        assert res.status_code == 200

        events = client.get("/api/events/mine", headers=auth(kayaoguz_token)).json()
        ids = [e["id"] for e in events]
        assert event["id"] not in ids

    def test_delete_nonexistent_event(self, client, kayaoguz_token):
        """Deleting a nonexistent event → 404."""
        res = client.delete("/api/events/99999", headers=auth(kayaoguz_token))
        assert res.status_code == 404

    def test_no_token_cannot_access_events(self, client):
        """Accessing events without token → 401 or 403."""
        res = client.get("/api/events/mine")
        assert res.status_code in (401, 403)


# ══════════════════════════════════════════════════════════════════════════════
# SHARED EVENTS
# ══════════════════════════════════════════════════════════════════════════════

class TestSharedEvents:

    def test_shared_event_visible_to_all_students(
            self, client, kayaoguz_token,
            emiray_token, yasemin_token, meltem_token, betul_token):
        """A shared event should be visible to all 4 students."""
        create_teacher_event(client, kayaoguz_token,
                             "Final Exam Date", "2026-07-01", shared=True)

        for token, name in [(emiray_token, "Emiray"), (yasemin_token, "Yasemin"),
                             (meltem_token, "Meltem"), (betul_token, "Betul")]:
            res = client.get("/api/events/shared", headers=auth(token))
            assert res.status_code == 200
            titles = [e["title"] for e in res.json()]
            assert "Final Exam Date" in titles, f"{name} cannot see shared event"

    def test_non_shared_event_not_in_shared_list(self, client, kayaoguz_token, emiray_token):
        """A non-shared event should NOT appear in the shared list."""
        create_teacher_event(client, kayaoguz_token,
                             "Private Event", "2026-07-01", shared=False)
        res = client.get("/api/events/shared", headers=auth(emiray_token))
        titles = [e["title"] for e in res.json()]
        assert "Private Event" not in titles

    def test_shared_event_visible_to_teacher_too(self, client, kayaoguz_token):
        """Teacher should also be able to see shared events."""
        create_teacher_event(client, kayaoguz_token,
                             "Teacher Shared Event", "2026-07-01", shared=True)
        res = client.get("/api/events/shared", headers=auth(kayaoguz_token))
        assert res.status_code == 200
        titles = [e["title"] for e in res.json()]
        assert "Teacher Shared Event" in titles

    def test_event_can_be_updated_to_shared(self, client, kayaoguz_token):
        """Kaya Oguz should be able to update an event to make it shared."""
        event = create_teacher_event(client, kayaoguz_token,
                                     "Not Shared Yet", "2026-07-01", shared=False)
        client.patch(f"/api/events/{event['id']}",
                     json={"is_shared": True},
                     headers=auth(kayaoguz_token))
        res = client.get("/api/events/shared", headers=auth(kayaoguz_token))
        titles = [e["title"] for e in res.json()]
        assert "Not Shared Yet" in titles


# ══════════════════════════════════════════════════════════════════════════════
# PERSONAL STUDENT EVENTS
# ══════════════════════════════════════════════════════════════════════════════

class TestPersonalEvents:

    def test_emiray_can_create_personal_event(self, client, emiray_token):
        """Emiray should be able to create a personal event."""
        res = client.post("/api/events/personal",
                          json={"title": "Study OS Chapter 3",
                                "event_date": "2026-06-10",
                                "description": "Review paging"},
                          headers=auth(emiray_token))
        assert res.status_code == 201
        assert res.json()["title"] == "Study OS Chapter 3"
        assert res.json()["created_by"] == "emiraydurmaz"
        assert res.json()["is_shared"] is False

    def test_all_students_can_create_personal_events(
            self, client, emiray_token, yasemin_token, meltem_token, betul_token):
        """All 4 students should be able to create personal events."""
        for token, name, title in [
            (emiray_token, "Emiray", "Emiray Study"),
            (yasemin_token, "Yasemin", "Yasemin Study"),
            (meltem_token, "Meltem", "Meltem Study"),
            (betul_token, "Betul", "Betul Study"),
        ]:
            res = client.post("/api/events/personal",
                              json={"title": title, "event_date": "2026-06-10"},
                              headers=auth(token))
            assert res.status_code == 201, f"{name} failed to create personal event"

    def test_students_only_see_their_own_personal_events(
            self, client, emiray_token, yasemin_token):
        """Emiray should not see Yasemin's personal events."""
        create_personal_event(client, emiray_token, "Emiray Private", "2026-06-10")
        create_personal_event(client, yasemin_token, "Yasemin Private", "2026-06-10")

        emiray_events = client.get("/api/events/my-personal",
                                   headers=auth(emiray_token)).json()
        yasemin_events = client.get("/api/events/my-personal",
                                    headers=auth(yasemin_token)).json()

        emiray_titles = [e["title"] for e in emiray_events]
        yasemin_titles = [e["title"] for e in yasemin_events]

        assert "Emiray Private" in emiray_titles
        assert "Yasemin Private" not in emiray_titles
        assert "Yasemin Private" in yasemin_titles
        assert "Emiray Private" not in yasemin_titles

    def test_emiray_can_update_her_personal_event(self, client, emiray_token):
        """Emiray should be able to update her personal event."""
        event = create_personal_event(client, emiray_token, "Old Study", "2026-06-10")
        res = client.patch(f"/api/events/personal/{event['id']}",
                           json={"title": "Updated Study"},
                           headers=auth(emiray_token))
        assert res.status_code == 200
        assert res.json()["title"] == "Updated Study"

    def test_cannot_update_another_students_personal_event(
            self, client, emiray_token, yasemin_token):
        """Yasemin should not be able to update Emiray's personal event → 403."""
        event = create_personal_event(client, emiray_token, "Emiray Event", "2026-06-10")
        res = client.patch(f"/api/events/personal/{event['id']}",
                           json={"title": "Hacked"},
                           headers=auth(yasemin_token))
        assert res.status_code == 403

    def test_meltem_can_delete_her_personal_event(self, client, meltem_token):
        """Meltem should be able to delete her personal event."""
        event = create_personal_event(client, meltem_token, "To Delete", "2026-06-10")
        res = client.delete(f"/api/events/personal/{event['id']}",
                            headers=auth(meltem_token))
        assert res.status_code == 200

        events = client.get("/api/events/my-personal",
                            headers=auth(meltem_token)).json()
        ids = [e["id"] for e in events]
        assert event["id"] not in ids

    def test_cannot_delete_another_students_personal_event(
            self, client, emiray_token, betul_token):
        """Betul should not be able to delete Emiray's personal event → 403."""
        event = create_personal_event(client, emiray_token, "Emiray Event", "2026-06-10")
        res = client.delete(f"/api/events/personal/{event['id']}",
                            headers=auth(betul_token))
        assert res.status_code == 403

    def test_kayaoguz_can_also_create_personal_event(self, client, kayaoguz_token):
        """Teacher Kaya Oguz can also create personal events."""
        res = client.post("/api/events/personal",
                          json={"title": "Grade Papers", "event_date": "2026-06-10"},
                          headers=auth(kayaoguz_token))
        assert res.status_code == 201
