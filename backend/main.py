from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routes.auth import router as auth_router
from api.routes.courses import router as courses_router
from api.routes.chats import router as chats_router
from api.routes.lessons import router as lessons_router

app = FastAPI(title="LLM Based Tutoring API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router,    prefix="/api")
app.include_router(courses_router, prefix="/api")
app.include_router(chats_router,   prefix="/api")
app.include_router(lessons_router, prefix="/api")


@app.get("/api/health")
def health():
    return {"status": "ok"}