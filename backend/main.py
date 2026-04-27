from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routes.auth import router as auth_router
from api.routes.courses import router as courses_router
from api.routes.chats import router as chats_router
from api.routes.lessons import router as lessons_router
from api.routes.admin import router as admin_router
from api.routes.notifications import router as notifications_router

from database import Base, engine
from api.routes.settings import router as settings_router
from models import User, Course, Lesson, Chat, Message, Material, CourseMaterial
from models.notification import Notification
from models.notification_read import NotificationRead

from dotenv import load_dotenv
load_dotenv(dotenv_path=".env")

app = FastAPI(title="AI Supported Learning System API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {"message": "Backend is running"}

@app.get("/api/health")
def health():
    return {"status": "ok"}

app.include_router(auth_router, prefix="/api")
app.include_router(courses_router, prefix="/api")
app.include_router(chats_router, prefix="/api")
app.include_router(lessons_router, prefix="/api")
app.include_router(admin_router, prefix="/api")
app.include_router(settings_router, prefix="/api")
app.include_router(notifications_router, prefix="/api")

Base.metadata.create_all(bind=engine)