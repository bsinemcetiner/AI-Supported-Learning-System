from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from sqlalchemy.orm import Session

from core.auth import get_current_user
from database import get_db
from models.calendar_event import CalendarEvent

router = APIRouter(prefix="/events", tags=["events"])


class EventCreate(BaseModel):
    title: str
    description: Optional[str] = ""
    event_date: str
    event_time: Optional[str] = ""
    color: Optional[str] = "#3b82f6"
    is_shared: Optional[bool] = False


class EventUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    event_date: Optional[str] = None
    event_time: Optional[str] = None
    color: Optional[str] = None
    is_shared: Optional[bool] = None


def _serialize(ev: CalendarEvent) -> dict:
    return {
        "id": ev.id,
        "title": ev.title,
        "description": ev.description,
        "event_date": ev.event_date,
        "event_time": ev.event_time,
        "color": ev.color,
        "created_by": ev.created_by,
        "is_shared": ev.is_shared,
        "created_at": ev.created_at.isoformat() if ev.created_at else None,
    }


def _username(current_user) -> str:
    if isinstance(current_user, dict):
        return current_user.get("username") or current_user.get("sub", "")
    return current_user.username


def _role(current_user) -> str:
    if isinstance(current_user, dict):
        return current_user.get("role", "")
    return current_user.role


# ── Teacher: list own events ─────────────────────────────────────
@router.get("/mine", response_model=List[dict])
def get_my_events(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if _role(current_user) != "teacher":
        raise HTTPException(status_code=403, detail="Only teachers can access this.")
    events = db.query(CalendarEvent).filter(
        CalendarEvent.created_by == _username(current_user)
    ).order_by(CalendarEvent.event_date).all()
    return [_serialize(e) for e in events]


# ── Teacher: create event ────────────────────────────────────────
@router.post("/", response_model=dict, status_code=201)
def create_event(
    body: EventCreate,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if _role(current_user) != "teacher":
        raise HTTPException(status_code=403, detail="Only teachers can create events.")
    ev = CalendarEvent(
        title=body.title,
        description=body.description or "",
        event_date=body.event_date,
        event_time=body.event_time or "",
        color=body.color or "#3b82f6",
        created_by=_username(current_user),
        is_shared=body.is_shared or False,
    )
    db.add(ev)
    db.commit()
    db.refresh(ev)
    return _serialize(ev)


# ── Teacher: update event ────────────────────────────────────────
@router.patch("/{event_id}", response_model=dict)
def update_event(
    event_id: int,
    body: EventUpdate,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ev = db.query(CalendarEvent).filter(CalendarEvent.id == event_id).first()
    if not ev:
        raise HTTPException(status_code=404, detail="Event not found.")
    if ev.created_by != _username(current_user):
        raise HTTPException(status_code=403, detail="Not your event.")
    if body.title is not None:
        ev.title = body.title
    if body.description is not None:
        ev.description = body.description
    if body.event_date is not None:
        ev.event_date = body.event_date
    if body.event_time is not None:
        ev.event_time = body.event_time
    if body.color is not None:
        ev.color = body.color
    if body.is_shared is not None:
        ev.is_shared = body.is_shared
    db.commit()
    db.refresh(ev)
    return _serialize(ev)


# ── Teacher: delete event ────────────────────────────────────────
@router.delete("/{event_id}", response_model=dict)
def delete_event(
    event_id: int,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ev = db.query(CalendarEvent).filter(CalendarEvent.id == event_id).first()
    if not ev:
        raise HTTPException(status_code=404, detail="Event not found.")
    if ev.created_by != _username(current_user):
        raise HTTPException(status_code=403, detail="Not your event.")
    db.delete(ev)
    db.commit()
    return {"message": "Deleted.", "id": event_id}


# ── Shared: teacher events visible to everyone ───────────────────
@router.get("/shared", response_model=List[dict])
def get_shared_events(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    events = db.query(CalendarEvent).filter(
        CalendarEvent.is_shared == True
    ).order_by(CalendarEvent.event_date).all()
    return [_serialize(e) for e in events]


# ── Student: list own personal events ───────────────────────────
@router.get("/my-personal", response_model=List[dict])
def get_my_personal_events(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    events = db.query(CalendarEvent).filter(
        CalendarEvent.created_by == _username(current_user),
        CalendarEvent.is_shared == False,
    ).order_by(CalendarEvent.event_date).all()
    return [_serialize(e) for e in events]


# ── Student: create personal event ──────────────────────────────
@router.post("/personal", response_model=dict, status_code=201)
def create_personal_event(
    body: EventCreate,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ev = CalendarEvent(
        title=body.title,
        description=body.description or "",
        event_date=body.event_date,
        event_time=body.event_time or "",
        color=body.color or "#3b82f6",
        created_by=_username(current_user),
        is_shared=False,  # student events are always personal
    )
    db.add(ev)
    db.commit()
    db.refresh(ev)
    return _serialize(ev)


# ── Student: update own personal event ──────────────────────────
@router.patch("/personal/{event_id}", response_model=dict)
def update_personal_event(
    event_id: int,
    body: EventUpdate,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ev = db.query(CalendarEvent).filter(CalendarEvent.id == event_id).first()
    if not ev:
        raise HTTPException(status_code=404, detail="Event not found.")
    if ev.created_by != _username(current_user):
        raise HTTPException(status_code=403, detail="Not your event.")
    if body.title is not None:
        ev.title = body.title
    if body.description is not None:
        ev.description = body.description
    if body.event_date is not None:
        ev.event_date = body.event_date
    if body.event_time is not None:
        ev.event_time = body.event_time
    if body.color is not None:
        ev.color = body.color
    db.commit()
    db.refresh(ev)
    return _serialize(ev)


# ── Student: delete own personal event ──────────────────────────
@router.delete("/personal/{event_id}", response_model=dict)
def delete_personal_event(
    event_id: int,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ev = db.query(CalendarEvent).filter(CalendarEvent.id == event_id).first()
    if not ev:
        raise HTTPException(status_code=404, detail="Event not found.")
    if ev.created_by != _username(current_user):
        raise HTTPException(status_code=403, detail="Not your event.")
    db.delete(ev)
    db.commit()
    return {"message": "Deleted.", "id": event_id}