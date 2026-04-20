from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel
from typing import Optional
from core.auth import create_access_token
from services.auth_manager import (
    login_user, signup_user, request_otp, verify_otp
)

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginRequest(BaseModel):
    username: str
    password: str


class SignupRequest(BaseModel):
    full_name: str
    username: str
    password: str
    role: str
    email: Optional[str] = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


class OtpRequest(BaseModel):
    email: str


class OtpVerifyRequest(BaseModel):
    email: str
    otp: str


# ─── OTP: Gönder ────────────────────────────────────────────
@router.post("/send-otp")
def send_otp(body: OtpRequest):
    success, message, role = request_otp(body.email)
    if not success:
        raise HTTPException(status_code=400, detail=message)
    return {"message": message, "role": role}


# ─── OTP: Doğrula ───────────────────────────────────────────
@router.post("/verify-otp")
def verify_otp_route(body: OtpVerifyRequest):
    success, message = verify_otp(body.email, body.otp)
    if not success:
        raise HTTPException(status_code=400, detail=message)
    return {"message": message, "verified": True}


# ─── Kayıt ──────────────────────────────────────────────────
@router.post("/signup", status_code=201)
def signup(body: SignupRequest):
    if not body.full_name.strip() or not body.username.strip() or not body.password.strip():
        raise HTTPException(status_code=400, detail="Tüm alanlar gerekli.")
    success, message = signup_user(
        full_name=body.full_name.strip(),
        username=body.username.strip(),
        password=body.password,
        role=body.role,
        email=body.email,
    )
    if not success:
        raise HTTPException(status_code=409, detail=message)
    return {"message": message}


# ─── Giriş ──────────────────────────────────────────────────
@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest):
    success, message, user = login_user(body.username.strip(), body.password)
    if not success:
        raise HTTPException(status_code=401, detail=message)
    token = create_access_token({"sub": user["username"], "role": user["role"]})
    return TokenResponse(
        access_token=token,
        user={"username": user["username"], "full_name": user["full_name"], "role": user["role"]},
    )


@router.post("/token", response_model=TokenResponse)
def login_for_swagger(form_data: OAuth2PasswordRequestForm = Depends()):
    success, message, user = login_user(form_data.username.strip(), form_data.password)
    if not success:
        raise HTTPException(status_code=401, detail=message)
    token = create_access_token({"sub": user["username"], "role": user["role"]})
    return TokenResponse(
        access_token=token,
        user={"username": user["username"], "full_name": user["full_name"], "role": user["role"]},
    )