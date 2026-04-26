from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship
from database import Base


class Chat(Base):
    __tablename__ = "chats"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False, default="New Chat")

    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    course_id = Column(String, nullable=True, index=True)
    lesson_id = Column(String, nullable=True, index=True)
    section_index = Column(Integer, nullable=True)
    mode = Column(String, nullable=False, default="direct")
    tone = Column(String, nullable=False, default="Professional Tutor")

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="chats")
    messages = relationship(
        "Message",
        back_populates="chat",
        cascade="all, delete-orphan",
        order_by="Message.created_at"
    )