"""
test_lessons.py — Lesson Tests

Strategy:
  - PDF upload endpoint calls pypdf + RAG + AI → all mocked
  - DB operations (create, get, approve, publish) tested directly via service layer
  - AI generation (streaming) is skipped — tested separately if needed

Test Scenarios:
  - Kaya Oguz uploads a lesson (PDF mocked)
  - Duplicate lesson upload rejected
  - Student cannot upload a lesson
  - Get lessons by course
  - Get single lesson by ID
  - Lesson not found returns 404
  - Update feedback
  - Update preview question
  - Approve section (with mock draft)
  - Unapprove section
  - Publish sections (with approved draft)
  - Toggle publish/unpublish
  - Student can start chat on published lesson
  - Student cannot start chat on unpublished lesson
"""

import io
import json
import pytest
from unittest.mock import patch, MagicMock

from tests.conftest import register_user, get_token, auth


# ─────────────────────────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────────────────────────

FAKE_PDF_BYTES = b"%PDF-1.4 fake pdf content for testing"
FAKE_PDF_TEXT  = "Introduction to Operating Systems\n\nThis section covers process management."


def upload_lesson(client, token: str, course_id: str,
                  week_title: str = "Week 1 - Introduction") -> dict:
    """Upload a lesson PDF with all external deps mocked. Returns response."""
    with patch("api.routes.lessons._read_pdf_bytes", return_value=FAKE_PDF_TEXT), \
         patch("api.routes.lessons._read_pdf_pages", return_value=[FAKE_PDF_TEXT]), \
         patch("api.routes.lessons._generate_section_titles_with_ai",
               return_value=[{
                   "section_index": 0,
                   "title": "Introduction",
                   "page_start": 1,
                   "page_end": 1,
                   "text": FAKE_PDF_TEXT,
                   "summary": "Overview of OS concepts.",
                   "draft": "",
                   "approved": False,
               }]), \
         patch("api.routes.lessons.rag") as mock_rag:

        mock_rag.add_document.return_value = {"chunks": 3, "skipped": False}

        fake_file = io.BytesIO(FAKE_PDF_BYTES)
        res = client.post(
            f"/api/lessons/upload",
            params={"course_id": course_id, "week_title": week_title},
            files={"file": ("lecture.pdf", fake_file, "application/pdf")},
            headers=auth(token),
        )
    return res


def create_course(client, token: str, name: str) -> str:
    res = client.post("/api/courses/",
                      json={"course_name": name},
                      headers=auth(token))
    assert res.status_code == 201, f"Course creation failed: {res.json()}"
    return res.json()["course_id"]


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
def course_id(client, kayaoguz_token):
    """A course created by Kaya Oguz."""
    return create_course(client, kayaoguz_token, "Operating Systems")


@pytest.fixture
def lesson_id(client, kayaoguz_token, course_id):
    """An uploaded lesson in the course."""
    res = upload_lesson(client, kayaoguz_token, course_id)
    assert res.status_code == 201, f"Lesson upload failed: {res.json()}"
    return res.json()["lesson_id"]


# ─────────────────────────────────────────────────────────────────────────────
# LESSON UPLOAD
# ─────────────────────────────────────────────────────────────────────────────

class TestLessonUpload:

    def test_kayaoguz_can_upload_lesson(self, client, kayaoguz_token, course_id):
        """Kaya Oguz should be able to upload a lesson PDF."""
        res = upload_lesson(client, kayaoguz_token, course_id)
        assert res.status_code == 201
        data = res.json()
        assert "lesson_id" in data
        assert "week_title" in data
        assert "section_count" in data
        assert data["section_count"] >= 1

    def test_duplicate_week_title_rejected(self, client, kayaoguz_token, course_id):
        """Uploading a lesson with the same week title in the same course → 409."""
        upload_lesson(client, kayaoguz_token, course_id, "Week 1 - Introduction")
        res = upload_lesson(client, kayaoguz_token, course_id, "Week 1 - Introduction")
        assert res.status_code == 409

    def test_student_cannot_upload_lesson(self, client, emiray_token, course_id):
        """Student Emiray should not be able to upload a lesson → 403."""
        res = upload_lesson(client, emiray_token, course_id)
        assert res.status_code == 403

    def test_no_token_cannot_upload_lesson(self, client, course_id):
        """Uploading without a token should be rejected → 401."""
        fake_file = io.BytesIO(FAKE_PDF_BYTES)
        res = client.post(
            "/api/lessons/upload",
            params={"course_id": course_id, "week_title": "Week X"},
            files={"file": ("lecture.pdf", fake_file, "application/pdf")},
        )
        assert res.status_code == 401

    def test_multiple_weeks_can_be_uploaded(self, client, kayaoguz_token, course_id):
        """Kaya Oguz should be able to upload multiple weeks."""
        res1 = upload_lesson(client, kayaoguz_token, course_id, "Week 1 - Intro")
        res2 = upload_lesson(client, kayaoguz_token, course_id, "Week 2 - Processes")
        assert res1.status_code == 201
        assert res2.status_code == 201
        assert res1.json()["lesson_id"] != res2.json()["lesson_id"]


# ─────────────────────────────────────────────────────────────────────────────
# LESSON RETRIEVAL
# ─────────────────────────────────────────────────────────────────────────────

class TestLessonRetrieval:

    def test_get_lessons_by_course(self, client, kayaoguz_token, course_id, lesson_id):
        """Kaya Oguz should be able to list all lessons in a course."""
        # /course/{id} returns only published lessons
        # /course/{id}/all returns all lessons (teacher only)
        res = client.get(f"/api/lessons/course/{course_id}/all",
                         headers=auth(kayaoguz_token))
        assert res.status_code == 200
        data = res.json()
        assert isinstance(data, dict)
        assert lesson_id in data

    def test_get_single_lesson(self, client, kayaoguz_token, lesson_id):
        """Should be able to retrieve a single lesson by ID."""
        res = client.get(f"/api/lessons/{lesson_id}",
                         headers=auth(kayaoguz_token))
        assert res.status_code == 200
        data = res.json()
        assert data["lesson_id"] == lesson_id
        assert data["teacher_username"] == "kayaoguz"

    def test_get_nonexistent_lesson_returns_404(self, client, kayaoguz_token):
        """Requesting a lesson that does not exist → 404."""
        res = client.get("/api/lessons/nonexistent::lesson_id",
                         headers=auth(kayaoguz_token))
        assert res.status_code == 404

    def test_get_sections(self, client, kayaoguz_token, lesson_id):
        """Should be able to retrieve sections for a lesson."""
        res = client.get(f"/api/lessons/{lesson_id}/sections",
                         headers=auth(kayaoguz_token))
        assert res.status_code == 200
        data = res.json()
        assert "sections" in data
        assert "total" in data
        assert data["total"] >= 1

    def test_student_can_get_lessons_by_course(self, client, emiray_token, course_id, lesson_id):
        """Students should be able to view published lessons in a course."""
        res = client.get(f"/api/lessons/course/{course_id}",
                         headers=auth(emiray_token))
        assert res.status_code == 200


# ─────────────────────────────────────────────────────────────────────────────
# FEEDBACK & PREVIEW QUESTION
# ─────────────────────────────────────────────────────────────────────────────

class TestLessonFeedback:

    def test_kayaoguz_can_submit_feedback(self, client, kayaoguz_token, lesson_id):
        """Kaya Oguz should be able to submit feedback for a lesson."""
        res = client.post(f"/api/lessons/{lesson_id}/feedback",
                          json={"feedback": "Please explain memory management more clearly."},
                          headers=auth(kayaoguz_token))
        assert res.status_code == 200
        assert res.json()["lesson_id"] == lesson_id

    def test_feedback_with_custom_prompt(self, client, kayaoguz_token, lesson_id):
        """Feedback with a custom prompt should also be accepted."""
        res = client.post(f"/api/lessons/{lesson_id}/feedback",
                          json={
                              "feedback": "Focus more on practical examples.",
                              "custom_prompt": "Use real-world OS examples like Linux."
                          },
                          headers=auth(kayaoguz_token))
        assert res.status_code == 200

    def test_student_cannot_submit_feedback(self, client, emiray_token, lesson_id):
        """Student Emiray should not be able to submit feedback → 403."""
        res = client.post(f"/api/lessons/{lesson_id}/feedback",
                          json={"feedback": "I think this is wrong."},
                          headers=auth(emiray_token))
        assert res.status_code == 403

    def test_feedback_on_nonexistent_lesson(self, client, kayaoguz_token):
        """Submitting feedback for a non-existent lesson → 404."""
        res = client.post("/api/lessons/fake::lesson/feedback",
                          json={"feedback": "This won't work."},
                          headers=auth(kayaoguz_token))
        assert res.status_code == 404

    def test_kayaoguz_can_update_preview_question(self, client, kayaoguz_token, lesson_id):
        """Kaya Oguz should be able to update the preview question."""
        res = client.patch(f"/api/lessons/{lesson_id}/preview-question",
                           json={"preview_question": "What is a process in OS?"},
                           headers=auth(kayaoguz_token))
        assert res.status_code == 200

    def test_student_cannot_update_preview_question(self, client, emiray_token, lesson_id):
        """Student Emiray should not be able to update preview question → 403."""
        res = client.patch(f"/api/lessons/{lesson_id}/preview-question",
                           json={"preview_question": "Hacked question"},
                           headers=auth(emiray_token))
        assert res.status_code == 403


# ─────────────────────────────────────────────────────────────────────────────
# SECTION APPROVE / UNAPPROVE
# ─────────────────────────────────────────────────────────────────────────────

class TestSectionApproval:

    def _inject_draft(self, lesson_id: str, section_index: int = 0):
        """Directly write a draft into the sections JSON file."""
        import os, json
        from api.routes.lessons import _safe_id, SECTIONS_DIR
        safe_id = _safe_id(lesson_id)
        path = os.path.join(SECTIONS_DIR, f"{safe_id}_sections.json")
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f:
                sections = json.load(f)
            sections[section_index]["draft"] = json.dumps({
                "hero_keyword": "operating system",
                "learning_objectives": ["Understand processes"],
                "slides": [{"type": "text", "content": "A process is a running program."}]
            })
            sections[section_index]["approved"] = False
            with open(path, "w", encoding="utf-8") as f:
                json.dump(sections, f)

    def test_kayaoguz_can_approve_section(self, client, kayaoguz_token, lesson_id):
        """Kaya Oguz should be able to approve a section that has a draft."""
        self._inject_draft(lesson_id, 0)
        res = client.patch(f"/api/lessons/{lesson_id}/sections/0/approve",
                           headers=auth(kayaoguz_token))
        assert res.status_code == 200
        assert res.json()["section_index"] == 0

    def test_approve_section_without_draft_rejected(self, client, kayaoguz_token, lesson_id):
        """Approving a section without a draft should be rejected → 400."""
        res = client.patch(f"/api/lessons/{lesson_id}/sections/0/approve",
                           headers=auth(kayaoguz_token))
        assert res.status_code == 400

    def test_student_cannot_approve_section(self, client, emiray_token, lesson_id):
        """Student Emiray should not be able to approve a section → 403."""
        res = client.patch(f"/api/lessons/{lesson_id}/sections/0/approve",
                           headers=auth(emiray_token))
        assert res.status_code == 403

    def test_kayaoguz_can_unapprove_section(self, client, kayaoguz_token, lesson_id):
        """Kaya Oguz should be able to unapprove a section."""
        self._inject_draft(lesson_id, 0)
        client.patch(f"/api/lessons/{lesson_id}/sections/0/approve",
                     headers=auth(kayaoguz_token))
        res = client.patch(f"/api/lessons/{lesson_id}/sections/0/unapprove",
                           headers=auth(kayaoguz_token))
        assert res.status_code == 200

    def test_invalid_section_index_rejected(self, client, kayaoguz_token, lesson_id):
        """Approving a section with an out-of-range index → 400."""
        res = client.patch(f"/api/lessons/{lesson_id}/sections/999/approve",
                           headers=auth(kayaoguz_token))
        assert res.status_code == 400


# ─────────────────────────────────────────────────────────────────────────────
# PUBLISH
# ─────────────────────────────────────────────────────────────────────────────

class TestLessonPublish:

    def _approve_section(self, client, kayaoguz_token, lesson_id):
        """Helper: inject draft and approve section 0."""
        import os, json
        from api.routes.lessons import _safe_id, SECTIONS_DIR
        safe_id = _safe_id(lesson_id)
        path = os.path.join(SECTIONS_DIR, f"{safe_id}_sections.json")
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f:
                sections = json.load(f)
            sections[0]["draft"] = '{"slides": [{"content": "Process = running program"}]}'
            sections[0]["approved"] = True
            with open(path, "w", encoding="utf-8") as f:
                json.dump(sections, f)

    def test_publish_without_approved_sections_rejected(self, client, kayaoguz_token, lesson_id):
        """Publishing a lesson with no approved sections → 400."""
        res = client.patch(f"/api/lessons/{lesson_id}/publish-sections",
                           headers=auth(kayaoguz_token))
        assert res.status_code == 400

    def test_kayaoguz_can_publish_lesson(self, client, kayaoguz_token, lesson_id):
        """Kaya Oguz should be able to publish a lesson with approved sections."""
        self._approve_section(client, kayaoguz_token, lesson_id)
        res = client.patch(f"/api/lessons/{lesson_id}/publish-sections",
                           headers=auth(kayaoguz_token))
        assert res.status_code == 200
        data = res.json()
        assert data["lesson_id"] == lesson_id
        assert data["section_count"] >= 1

    def test_student_cannot_publish(self, client, emiray_token, lesson_id):
        """Student Emiray should not be able to publish a lesson → 403."""
        res = client.patch(f"/api/lessons/{lesson_id}/publish-sections",
                           headers=auth(emiray_token))
        assert res.status_code == 403

    def test_toggle_publish_true(self, client, kayaoguz_token, lesson_id):
        """Kaya Oguz should be able to toggle lesson publish state to True."""
        res = client.patch(f"/api/lessons/{lesson_id}/publish",
                           json={"is_published": True},
                           headers=auth(kayaoguz_token))
        assert res.status_code == 200
        assert res.json()["is_published"] is True

    def test_toggle_publish_false(self, client, kayaoguz_token, lesson_id):
        """Kaya Oguz should be able to unpublish a lesson."""
        client.patch(f"/api/lessons/{lesson_id}/publish",
                     json={"is_published": True},
                     headers=auth(kayaoguz_token))
        res = client.patch(f"/api/lessons/{lesson_id}/publish",
                           json={"is_published": False},
                           headers=auth(kayaoguz_token))
        assert res.status_code == 200
        assert res.json()["is_published"] is False


# ─────────────────────────────────────────────────────────────────────────────
# LESSON CHAT (start chat on published lesson)
# ─────────────────────────────────────────────────────────────────────────────

class TestLessonChat:

    def _publish_lesson(self, client, kayaoguz_token, lesson_id):
        """Approve + publish lesson so students can chat."""
        import os, json
        from api.routes.lessons import _safe_id, SECTIONS_DIR
        safe_id = _safe_id(lesson_id)
        path = os.path.join(SECTIONS_DIR, f"{safe_id}_sections.json")
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f:
                sections = json.load(f)
            sections[0]["draft"] = "This lesson covers process management in OS."
            sections[0]["approved"] = True
            with open(path, "w", encoding="utf-8") as f:
                json.dump(sections, f)
        client.patch(f"/api/lessons/{lesson_id}/publish-sections",
                     headers=auth(kayaoguz_token))

    def test_emiray_can_start_chat_on_published_lesson(
            self, client, kayaoguz_token, emiray_token, lesson_id):
        """Emiray should be able to start a chat on a published lesson."""
        self._publish_lesson(client, kayaoguz_token, lesson_id)
        res = client.post(f"/api/lessons/{lesson_id}/chat",
                          json={"tone": "Professional Tutor", "mode": "direct"},
                          headers=auth(emiray_token))
        assert res.status_code == 201
        assert "chat_id" in res.json()

    def test_yasemin_cannot_chat_on_unpublished_lesson(
            self, client, yasemin_token, lesson_id):
        """Yasemin should not be able to chat on an unpublished lesson → 403."""
        res = client.post(f"/api/lessons/{lesson_id}/chat",
                          json={"tone": "Friendly Mentor", "mode": "rag"},
                          headers=auth(yasemin_token))
        assert res.status_code == 403

    def test_no_token_cannot_start_chat(self, client, lesson_id):
        """Starting a chat without token → 401."""
        res = client.post(f"/api/lessons/{lesson_id}/chat",
                          json={"tone": "Professional Tutor", "mode": "direct"})
        assert res.status_code == 401

    def test_emiray_starting_chat_twice_returns_same_chat(
            self, client, kayaoguz_token, emiray_token, lesson_id):
        """Emiray starting a chat on the same lesson twice should reuse the existing chat."""
        self._publish_lesson(client, kayaoguz_token, lesson_id)
        res1 = client.post(f"/api/lessons/{lesson_id}/chat",
                           json={"tone": "Professional Tutor", "mode": "direct"},
                           headers=auth(emiray_token))
        res2 = client.post(f"/api/lessons/{lesson_id}/chat",
                           json={"tone": "Friendly Mentor", "mode": "rag"},
                           headers=auth(emiray_token))
        assert res1.status_code == 201
        assert res2.status_code == 201
        assert res1.json()["chat_id"] == res2.json()["chat_id"]
