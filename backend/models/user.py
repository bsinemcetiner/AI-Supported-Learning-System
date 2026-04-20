from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship
from database import Base


class User(Base):
    __tablename__ = "users"

    id            = Column(Integer, primary_key=True, index=True)
    full_name     = Column(String, nullable=False)
    username      = Column(String, unique=True, nullable=False, index=True)
    password      = Column(String, nullable=True)
    role          = Column(String, nullable=False)
    email         = Column(String, unique=True, nullable=True)
    password_hash = Column(String, nullable=True)

    chats = relationship("Chat", back_populates="user", cascade="all, delete-orphan")