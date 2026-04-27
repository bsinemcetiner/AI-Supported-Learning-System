from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime

from core.auth import get_current_user, require_teacher
from database import get_db
from models.notification import Notification
from models.notification_read import NotificationRead
from models.student_course import StudentCourseAssignment
from models.user import User

router = APIRouter(prefix="/notifications", tags=["notifications"])


def _notification_to_dict(n: Notification, is_read: bool) -> dict:
    return {
        "id": n.id,
        "course_id": n.course_id,
        "title": n.title,
        "message": n.message,
        "type": n.type,
        "created_at": n.created_at.isoformat() if n.created_at else None,
        "created_by": n.created_by,
        "is_read": is_read,
    }


def create_notification(
    db: Session,
    course_id: str,
    title: str,
    message: str,
    created_by: str,
    type: str = "info",
):
    """Helper to create a notification — call from other routes."""
    n = Notification(
        course_id=course_id,
        title=title,
        message=message,
        type=type,
        created_by=created_by,
    )
    db.add(n)
    db.commit()
    db.refresh(n)
    return n


# ── GET /notifications ── current user's notifications (enrolled courses)
@router.get("/")
def get_my_notifications(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    username = current_user["username"]
    role = current_user["role"]

    user = db.query(User).filter(User.username == username).first()
    if not user:
        return {"notifications": [], "unread_count": 0}

    # Teachers see notifications for their own courses
    if role == "teacher":
        from models.course import Course
        teacher_courses = db.query(Course).filter(Course.teacher_username == username).all()
        course_ids = [c.course_id for c in teacher_courses]
    else:
        assignments = db.query(StudentCourseAssignment).filter_by(student_id=user.id).all()
        course_ids = [a.course_id for a in assignments]

    if not course_ids:
        return {"notifications": [], "unread_count": 0}

    notifications = (
        db.query(Notification)
        .filter(Notification.course_id.in_(course_ids))
        .order_by(Notification.created_at.desc())
        .limit(50)
        .all()
    )

    read_ids = set(
        r.notification_id
        for r in db.query(NotificationRead)
        .filter(
            NotificationRead.user_id == user.id,
            NotificationRead.notification_id.in_([n.id for n in notifications]),
        )
        .all()
    )

    result = [_notification_to_dict(n, n.id in read_ids) for n in notifications]
    unread_count = sum(1 for r in result if not r["is_read"])

    return {"notifications": result, "unread_count": unread_count}


# ── PATCH /notifications/{id}/read ── mark single as read
@router.patch("/{notification_id}/read")
def mark_read(
    notification_id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.username == current_user["username"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    existing = db.query(NotificationRead).filter_by(
        notification_id=notification_id, user_id=user.id
    ).first()
    if not existing:
        db.add(NotificationRead(notification_id=notification_id, user_id=user.id))
        db.commit()
    return {"ok": True}


# ── PATCH /notifications/read-all ── mark all as read
@router.patch("/read-all")
def mark_all_read(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    username = current_user["username"]
    role = current_user["role"]

    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if role == "teacher":
        from models.course import Course
        teacher_courses = db.query(Course).filter(Course.teacher_username == username).all()
        course_ids = [c.course_id for c in teacher_courses]
    else:
        assignments = db.query(StudentCourseAssignment).filter_by(student_id=user.id).all()
        course_ids = [a.course_id for a in assignments]

    if not course_ids:
        return {"ok": True}

    notifications = db.query(Notification).filter(Notification.course_id.in_(course_ids)).all()
    existing_read_ids = set(
        r.notification_id
        for r in db.query(NotificationRead).filter_by(user_id=user.id).all()
    )

    for n in notifications:
        if n.id not in existing_read_ids:
            db.add(NotificationRead(notification_id=n.id, user_id=user.id))

    db.commit()
    return {"ok": True}


# ── POST /notifications ── teacher sends manual announcement
class CreateNotificationRequest(BaseModel):
    course_id: str
    title: str
    message: str
    type: Optional[str] = "announcement"


@router.post("/", status_code=201)
def send_notification(
    body: CreateNotificationRequest,
    current_user: dict = Depends(require_teacher),
    db: Session = Depends(get_db),
):
    n = create_notification(
        db=db,
        course_id=body.course_id,
        title=body.title,
        message=body.message,
        created_by=current_user["username"],
        type=body.type,
    )
    return _notification_to_dict(n, False)