"""
conftest.py — Shared test infrastructure (FIXED)

Fixes:
  1. auth_manager.SessionLocal patched to use test DB → enroll 404 solved
  2. Each test gets a fresh DB via function-scoped engine → duplicate 409 solved
"""

import sys
import os
import pytest
from unittest.mock import patch

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from database import Base, get_db
from main import app

TEST_DB_URL = "sqlite:///./test_temp.db"


# ── Fresh engine + tables for every single test ───────────────────────────────
@pytest.fixture
def db():
    engine = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
    TestingSession = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    Base.metadata.create_all(bind=engine)

    session = TestingSession()

    # ── CRITICAL FIX: patch auth_manager's SessionLocal to use our test DB ──
    import services.auth_manager as am
    original_session_local = am.SessionLocal
    am.SessionLocal = TestingSession

    try:
        yield session
    finally:
        session.close()
        am.SessionLocal = original_session_local   # restore original
        Base.metadata.drop_all(bind=engine)
        engine.dispose()
        try:
            if os.path.exists(TEST_DB_URL.replace("sqlite:///./", "")):
                os.remove(TEST_DB_URL.replace("sqlite:///./", ""))
        except PermissionError:
            pass


# ── FastAPI test client with overridden DB dependency ─────────────────────────
@pytest.fixture
def client(db):
    def override_get_db():
        yield db

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


# ─────────────────────────────────────────────────────────────────────────────
# HELPER FUNCTIONS
# ─────────────────────────────────────────────────────────────────────────────

def register_user(client, full_name: str, username: str, password: str,
                  role: str, email: str):
    """Register a user bypassing OTP verification."""
    import services.auth_manager as am
    am._verified_emails.add(email.lower().strip())

    return client.post("/api/auth/signup", json={
        "full_name": full_name,
        "username": username,
        "password": password,
        "role": role,
        "email": email,
    })


def get_token(client, username: str, password: str) -> str:
    """Login and return access_token."""
    res = client.post("/api/auth/login", json={
        "username": username,
        "password": password,
    })
    assert res.status_code == 200, f"Login failed: {res.json()}"
    return res.json()["access_token"]


def auth(token: str) -> dict:
    """Return Authorization header dict."""
    return {"Authorization": f"Bearer {token}"}


# ─────────────────────────────────────────────────────────────────────────────
# USER FIXTURES
# ─────────────────────────────────────────────────────────────────────────────

@pytest.fixture
def kayaoguz_token(client):
    """Teacher: Kaya Oguz"""
    register_user(client, "Kaya Oguz", "kayaoguz",
                  "KayaOguz2024!", "teacher", "kaya.oguz@ieu.edu.tr")
    return get_token(client, "kayaoguz", "KayaOguz2024!")


@pytest.fixture
def emiray_token(client):
    """Student: Emiray Durmaz"""
    register_user(client, "Emiray Durmaz", "emiraydurmaz",
                  "Emiray2024!", "student", "emiray.durmaz@std.ieu.edu.tr")
    return get_token(client, "emiraydurmaz", "Emiray2024!")


@pytest.fixture
def yasemin_token(client):
    """Student: Yasemin Guler Kocar"""
    register_user(client, "Yasemin Guler Kocar", "yaseminguler",
                  "Yasemin2024!", "student", "yasemin.guler@std.ieu.edu.tr")
    return get_token(client, "yaseminguler", "Yasemin2024!")


@pytest.fixture
def meltem_token(client):
    """Student: Meltem Demir"""
    register_user(client, "Meltem Demir", "meltemdemir",
                  "Meltem2024!", "student", "meltem.demir@std.ieu.edu.tr")
    return get_token(client, "meltemdemir", "Meltem2024!")


@pytest.fixture
def betul_token(client):
    """Student: Betul Sinem Cetiner"""
    register_user(client, "Betul Sinem Cetiner", "betulcetin",
                  "Betul2024!", "student", "betul.cetiner@std.ieu.edu.tr")
    return get_token(client, "betulcetin", "Betul2024!")
