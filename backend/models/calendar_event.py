from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from database import Base
from datetime import datetime


class CalendarEvent(Base):
    __tablename__ = "calendar_events"

    id             = Column(Integer, primary_key=True, index=True)
    title          = Column(String, nullable=False)
    description    = Column(String, nullable=True, default="")
    event_date     = Column(String, nullable=False)   # "YYYY-MM-DD"
    event_time     = Column(String, nullable=True, default="")  # "HH:MM-HH:MM" or ""
    color          = Column(String, nullable=False, default="#3b82f6")
    created_by     = Column(String, nullable=False)   # teacher username
    is_shared      = Column(Boolean, nullable=False, default=False)  # shared to students?
    created_at     = Column(DateTime, default=datetime.utcnow)