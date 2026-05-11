"""
test_analytics.py — Analytics Tests

Test Scenarios:

  Struggle Analytics (/analytics/struggles):
  - Kaya Oguz can get struggle analytics for his courses
  - Student cannot access struggle analytics → 403
  - No token rejected → 401
  - No courses returns empty struggles
  - Returns correct structure
  - struggle_alert notifications are included
  - Non-struggle notifications are excluded
  - hours parameter filters correctly
  - Multiple sections deduplicated (latest per section)
  - Results sorted by question count (highest first)
  - Total questions count is correct
"""

import pytest
from datetime import datetime, timedelta
from tests.conftest import register_user, get_token, auth
from models.notification import Notification
from models.course import Course


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


def inject_course(db, course_id: str, course_name: str,
                  teacher_username: str = "kayaoguz") -> Course:
    """Inject a course directly into DB."""
    course = Course(
        course_id=course_id,
        course_name=course_name,
        teacher_username=teacher_username,
        created_at=datetime.utcnow(),
    )
    db.add(course)
    db.flush()
    return course


def inject_struggle_alert(db, course_id: str, section_name: str,
                           question_count: int, keywords: list,
                           hours_ago: float = 1.0) -> Notification:
    """Inject a struggle_alert notification directly into DB."""
    keywords_str = "\n".join(f"  • {k}" for k in keywords)
    message = (
        f"{question_count} confusion questions detected in this section.\n"
        f"Top confusion keywords:\n{keywords_str}"
    )
    notif = Notification(
        course_id=course_id,
        title=f"📊 Students struggling: {section_name}",
        message=message,
        type="struggle_alert",
        created_by="system",
        target_role="teacher",
        created_at=datetime.utcnow() - timedelta(hours=hours_ago),
    )
    db.add(notif)
    db.flush()
    return notif


# ══════════════════════════════════════════════════════════════════════════════
# ACCESS CONTROL
# ══════════════════════════════════════════════════════════════════════════════

class TestAnalyticsAccess:

    def test_kayaoguz_can_access_analytics(self, client, kayaoguz_token):
        """Kaya Oguz should be able to access struggle analytics."""
        res = client.get("/api/analytics/struggles",
                         headers=auth(kayaoguz_token))
        assert res.status_code == 200

    def test_student_cannot_access_analytics(self, client, emiray_token):
        """Student Emiray should not be able to access analytics → 403."""
        res = client.get("/api/analytics/struggles",
                         headers=auth(emiray_token))
        assert res.status_code == 403

    def test_yasemin_cannot_access_analytics(self, client, yasemin_token):
        """Student Yasemin should not be able to access analytics → 403."""
        res = client.get("/api/analytics/struggles",
                         headers=auth(yasemin_token))
        assert res.status_code == 403

    def test_no_token_cannot_access_analytics(self, client):
        """Accessing analytics without token → 401 or 403."""
        res = client.get("/api/analytics/struggles")
        assert res.status_code in (401, 403)


# ══════════════════════════════════════════════════════════════════════════════
# RESPONSE STRUCTURE
# ══════════════════════════════════════════════════════════════════════════════

class TestAnalyticsStructure:

    def test_empty_courses_returns_empty_struggles(self, client, kayaoguz_token):
        """Teacher with no courses should get empty struggles."""
        res = client.get("/api/analytics/struggles",
                         headers=auth(kayaoguz_token))
        assert res.status_code == 200
        data = res.json()
        assert data["struggles"] == []
        assert data["total_questions"] == 0

    def test_response_contains_correct_top_level_fields(
            self, client, kayaoguz_token):
        """Response should contain struggles and total_questions."""
        res = client.get("/api/analytics/struggles",
                         headers=auth(kayaoguz_token))
        data = res.json()
        assert "struggles" in data
        assert "total_questions" in data

    def test_default_request_returns_200(self, client, kayaoguz_token):
        """Default analytics request should return 200."""
        res = client.get("/api/analytics/struggles",
                         headers=auth(kayaoguz_token))
        assert res.status_code == 200

    def test_custom_hours_parameter_accepted(self, client, kayaoguz_token):
        """Custom hours parameter should be accepted without error."""
        res = client.get("/api/analytics/struggles?hours=48",
                         headers=auth(kayaoguz_token))
        assert res.status_code == 200
        assert "struggles" in res.json()


# ══════════════════════════════════════════════════════════════════════════════
# STRUGGLE ALERTS CONTENT
# ══════════════════════════════════════════════════════════════════════════════

class TestAnalyticsContent:

    def test_struggle_alert_appears_in_analytics(
            self, client, kayaoguz_token, db):
        """A struggle_alert notification should appear in analytics."""
        inject_course(db, "kayaoguz::os_course", "Operating Systems")
        inject_struggle_alert(db, "kayaoguz::os_course",
                               "Section 1 - Processes", 8,
                               ["scheduling", "context switch", "PCB"])
        db.commit()

        res = client.get("/api/analytics/struggles",
                         headers=auth(kayaoguz_token))
        data = res.json()
        assert len(data["struggles"]) >= 1
        assert data["total_questions"] >= 8

    def test_struggle_item_contains_correct_fields(
            self, client, kayaoguz_token, db):
        """Each struggle item should have expected fields."""
        inject_course(db, "kayaoguz::os_course2", "OS Course 2")
        inject_struggle_alert(db, "kayaoguz::os_course2",
                               "Section 2", 5, ["paging", "segmentation"])
        db.commit()

        res = client.get("/api/analytics/struggles",
                         headers=auth(kayaoguz_token))
        struggle = res.json()["struggles"][0]
        assert "course_id" in struggle
        assert "course_name" in struggle
        assert "section_name" in struggle
        assert "question_count" in struggle
        assert "keywords" in struggle
        assert "created_at" in struggle

    def test_non_struggle_notifications_excluded(
            self, client, kayaoguz_token, db):
        """Regular announcements should NOT appear in struggle analytics."""
        inject_course(db, "kayaoguz::announce_course", "Announce Course")
        # Regular announcement — not a struggle_alert
        notif = Notification(
            course_id="kayaoguz::announce_course",
            title="New Material",
            message="Check the new PDF.",
            type="announcement",
            created_by="kayaoguz",
            target_role="student",
            created_at=datetime.utcnow(),
        )
        db.add(notif)
        db.commit()

        res = client.get("/api/analytics/struggles",
                         headers=auth(kayaoguz_token))
        section_names = [s["section_name"] for s in res.json()["struggles"]]
        assert "New Material" not in section_names

    def test_multiple_sections_in_analytics(
            self, client, kayaoguz_token, db):
        """Multiple sections should all appear in analytics."""
        inject_course(db, "kayaoguz::multi_course", "Multi Section Course")
        inject_struggle_alert(db, "kayaoguz::multi_course",
                               "Section 1", 10, ["processes"])
        inject_struggle_alert(db, "kayaoguz::multi_course",
                               "Section 2", 5, ["memory"])
        inject_struggle_alert(db, "kayaoguz::multi_course",
                               "Section 3", 3, ["IO"])
        db.commit()

        res = client.get("/api/analytics/struggles",
                         headers=auth(kayaoguz_token))
        assert len(res.json()["struggles"]) >= 3
        assert res.json()["total_questions"] >= 18

    def test_results_sorted_by_question_count_descending(
            self, client, kayaoguz_token, db):
        """Struggles should be sorted by question_count descending."""
        inject_course(db, "kayaoguz::sort_course", "Sort Course")
        inject_struggle_alert(db, "kayaoguz::sort_course",
                               "Low Section", 3, ["easy"])
        inject_struggle_alert(db, "kayaoguz::sort_course",
                               "High Section", 15, ["hard"])
        inject_struggle_alert(db, "kayaoguz::sort_course",
                               "Mid Section", 8, ["medium"])
        db.commit()

        res = client.get("/api/analytics/struggles",
                         headers=auth(kayaoguz_token))
        counts = [s["question_count"] for s in res.json()["struggles"]]
        assert counts == sorted(counts, reverse=True)

    def test_hours_filter_excludes_old_alerts(
            self, client, kayaoguz_token, db):
        """Alerts older than the hours filter should be excluded."""
        inject_course(db, "kayaoguz::hours_course", "Hours Course")
        # Alert from 30 hours ago
        inject_struggle_alert(db, "kayaoguz::hours_course",
                               "Old Section", 10, ["old"],
                               hours_ago=30)
        # Alert from 1 hour ago
        inject_struggle_alert(db, "kayaoguz::hours_course",
                               "Recent Section", 5, ["recent"],
                               hours_ago=1)
        db.commit()

        # With hours=24, only recent should appear
        res = client.get("/api/analytics/struggles?hours=24",
                         headers=auth(kayaoguz_token))
        section_names = [s["section_name"] for s in res.json()["struggles"]]
        assert "Recent Section" in section_names
        assert "Old Section" not in section_names

    def test_keywords_extracted_correctly(
            self, client, kayaoguz_token, db):
        """Keywords should be correctly extracted from notification message."""
        inject_course(db, "kayaoguz::kw_course", "Keywords Course")
        inject_struggle_alert(db, "kayaoguz::kw_course",
                               "Keyword Section", 7,
                               ["virtual memory", "TLB", "page fault"])
        db.commit()

        res = client.get("/api/analytics/struggles",
                         headers=auth(kayaoguz_token))
        struggle = res.json()["struggles"][0]
        assert "virtual memory" in struggle["keywords"]
        assert "TLB" in struggle["keywords"]

    def test_total_questions_sum_is_correct(
            self, client, kayaoguz_token, db):
        """Total questions should be the sum of all struggle question counts."""
        inject_course(db, "kayaoguz::total_course", "Total Course")
        inject_struggle_alert(db, "kayaoguz::total_course",
                               "Section A", 10, ["a"])
        inject_struggle_alert(db, "kayaoguz::total_course",
                               "Section B", 7, ["b"])
        db.commit()

        res = client.get("/api/analytics/struggles",
                         headers=auth(kayaoguz_token))
        data = res.json()
        calculated_total = sum(s["question_count"] for s in data["struggles"])
        assert data["total_questions"] == calculated_total
