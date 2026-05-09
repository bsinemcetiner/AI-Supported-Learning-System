"""
GET /api/notifications/analytics/struggles
Teacher'ın kurslarındaki struggle_alert bildirimlerini
section bazlı özetleyerek döndürür.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
import re

from core.auth import require_teacher
from database import get_db
from models.notification import Notification
from models.course import Course

router = APIRouter(prefix="/analytics", tags=["analytics"])


def _extract_keywords(message: str) -> list:
    """Notification mesajından top confusion keywords'ü çıkar."""
    # "Most confusing concepts:\n  • X\n  • Y" veya
    # "Top confusion keywords:\n  • X\n  • Y" formatını parse et
    keywords = []
    lines = message.split("\n")
    for line in lines:
        stripped = line.strip()
        if stripped.startswith("•"):
            kw = stripped.lstrip("•").strip()
            if kw:
                keywords.append(kw)
    return keywords[:3]


def _extract_count(message: str) -> int:
    """Notification mesajından soru sayısını çıkar."""
    match = re.search(r"(\d+)\s+confusion questions", message)
    if match:
        return int(match.group(1))
    return 0


@router.get("/struggles")
def get_struggle_analytics(
    hours: int = 24,
    current_user: dict = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    """
    Teacher'ın kurslarındaki son N saatteki struggle_alert'leri döndür.
    Her section için en güncel bildirimi kullan.
    """
    username = current_user["username"]

    # Teacher'ın kursları
    teacher_courses = db.query(Course).filter(Course.teacher_username == username).all()
    course_ids = [c.course_id for c in teacher_courses]
    course_map = {c.course_id: c for c in teacher_courses}

    if not course_ids:
        return {"struggles": [], "total_questions": 0}

    cutoff = datetime.utcnow() - timedelta(hours=hours)

    alerts = (
        db.query(Notification)
        .filter(
            Notification.course_id.in_(course_ids),
            Notification.type == "struggle_alert",
            Notification.created_at >= cutoff,
        )
        .order_by(Notification.created_at.desc())
        .all()
    )

    # Section başına en güncel alert'i al (title ile deduplicate)
    seen_titles = {}
    for alert in alerts:
        key = f"{alert.course_id}::{alert.title}"
        if key not in seen_titles:
            seen_titles[key] = alert

    struggles = []
    total_questions = 0

    for key, alert in seen_titles.items():
        count = _extract_count(alert.message)
        keywords = _extract_keywords(alert.message)
        course = course_map.get(alert.course_id)
        course_name = course.course_name if course else alert.course_id

        # Title'dan section adını çıkar: "📊 Students struggling: Section 2"
        section_name = alert.title.replace("📊 Students struggling:", "").strip()

        struggles.append({
            "id": alert.id,
            "course_id": alert.course_id,
            "course_name": course_name,
            "section_name": section_name,
            "question_count": count,
            "keywords": keywords,
            "created_at": alert.created_at.isoformat() if alert.created_at else None,
        })
        total_questions += count

    # Soru sayısına göre sırala (en fazla olan üstte)
    struggles.sort(key=lambda x: x["question_count"], reverse=True)

    return {
        "struggles": struggles,
        "total_questions": total_questions,
        "hours": hours,
    }
