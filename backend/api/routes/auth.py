from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel

from core.auth import create_access_token
from services.auth_manager import login_user, signup_user

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginRequest(BaseModel):
    username: str
    password: str


class SignupRequest(BaseModel):
    full_name: str
    username: str
    password: str
    role: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


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


@router.post("/signup", status_code=201)
def signup(body: SignupRequest):
    if not body.full_name.strip() or not body.username.strip() or not body.password.strip():
        raise HTTPException(status_code=400, detail="All fields are required")
    success, message = signup_user(
        full_name=body.full_name.strip(),
        username=body.username.strip(),
        password=body.password,
        role=body.role,
    )
    if not success:
        raise HTTPException(status_code=409, detail=message)
    return {"message": message}