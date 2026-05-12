from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime, timezone

from core.auth import get_current_user
from database import get_db
from models.student_note import StudentNote
from models.user import User

router = APIRouter(prefix="/notes", tags=["notes"])


def _note_to_dict(n: StudentNote) -> dict:
    def to_utc_iso(dt):
        if dt is None:
            return None
        # If timezone-aware, convert to UTC. If naive, assume it's already UTC.
        if dt.tzinfo is not None:
            from datetime import timezone as tz
            dt = dt.astimezone(tz.utc).replace(tzinfo=None)
        return dt.isoformat() + "Z"

    return {
        "id": n.id,
        "course_id": n.course_id,
        "lesson_id": n.lesson_id,
        "section_index": n.section_index,
        "course_name": n.course_name,
        "lesson_title": n.lesson_title,
        "section_title": n.section_title,
        "content": n.content,
        "created_at": to_utc_iso(n.created_at),
        "updated_at": to_utc_iso(n.updated_at),
    }


def _get_user(db: Session, username: str) -> User:
    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


def _find_note(db: Session, user_id: int, lesson_id: Optional[str],
               course_id: Optional[str], section_index: Optional[int]) -> Optional[StudentNote]:
    q = db.query(StudentNote).filter(StudentNote.user_id == user_id)
    if lesson_id:
        q = q.filter(StudentNote.lesson_id == lesson_id)
    elif course_id:
        q = q.filter(StudentNote.course_id == course_id)
    else:
        return None
    if section_index is not None:
        q = q.filter(StudentNote.section_index == section_index)
    else:
        q = q.filter(StudentNote.section_index.is_(None))
    return q.first()


class CreateNoteRequest(BaseModel):
    course_id: Optional[str] = None
    lesson_id: Optional[str] = None
    section_index: Optional[int] = None
    course_name: Optional[str] = None
    lesson_title: Optional[str] = None
    section_title: Optional[str] = None
    content: str = ""


class UpdateNoteRequest(BaseModel):
    content: str
    course_name: Optional[str] = None
    lesson_title: Optional[str] = None
    section_title: Optional[str] = None


# ── GET /notes ────────────────────────────────────────────────────────────────

@router.get("/")
def get_my_notes(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user = _get_user(db, current_user["username"])
    notes = (
        db.query(StudentNote)
        .filter(StudentNote.user_id == user.id)
        .order_by(StudentNote.updated_at.desc())
        .all()
    )
    return {"notes": [_note_to_dict(n) for n in notes]}


# ── GET /notes/by-context ─────────────────────────────────────────────────────

@router.get("/by-context")
def get_note_by_context(
    course_id: Optional[str] = None,
    lesson_id: Optional[str] = None,
    section_index: Optional[int] = None,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user = _get_user(db, current_user["username"])
    note = _find_note(db, user.id, lesson_id, course_id, section_index)
    return {"note": _note_to_dict(note) if note else None}


# ── POST /notes — idempotent create (returns existing if already present) ─────

@router.post("/", status_code=201)
def create_note(
    body: CreateNoteRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user = _get_user(db, current_user["username"])

    # Guard against duplicate: if a note already exists for this context, return it
    existing = _find_note(db, user.id, body.lesson_id, body.course_id, body.section_index)
    if existing:
        # Update labels if they were missing
        changed = False
        if body.section_title and not existing.section_title:
            existing.section_title = body.section_title
            changed = True
        if body.lesson_title and not existing.lesson_title:
            existing.lesson_title = body.lesson_title
            changed = True
        if body.course_name and not existing.course_name:
            existing.course_name = body.course_name
            changed = True
        if changed:
            db.commit()
            db.refresh(existing)
        return _note_to_dict(existing)

    note = StudentNote(
        user_id=user.id,
        course_id=body.course_id,
        lesson_id=body.lesson_id,
        section_index=body.section_index,
        course_name=body.course_name,
        lesson_title=body.lesson_title,
        section_title=body.section_title,
        content=body.content,
    )
    db.add(note)
    db.commit()
    db.refresh(note)
    return _note_to_dict(note)


# ── PATCH /notes/{note_id} ────────────────────────────────────────────────────

@router.patch("/{note_id}")
def update_note(
    note_id: int,
    body: UpdateNoteRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user = _get_user(db, current_user["username"])
    note = db.query(StudentNote).filter(
        StudentNote.id == note_id,
        StudentNote.user_id == user.id,
    ).first()

    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    note.content = body.content
    if body.course_name is not None:
        note.course_name = body.course_name
    if body.lesson_title is not None:
        note.lesson_title = body.lesson_title
    if body.section_title is not None:
        note.section_title = body.section_title
    note.updated_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(note)
    return _note_to_dict(note)


# ── DELETE /notes/{note_id} ───────────────────────────────────────────────────

@router.delete("/{note_id}", status_code=204)
def delete_note(
    note_id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user = _get_user(db, current_user["username"])
    note = db.query(StudentNote).filter(
        StudentNote.id == note_id,
        StudentNote.user_id == user.id,
    ).first()

    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    db.delete(note)
    db.commit()