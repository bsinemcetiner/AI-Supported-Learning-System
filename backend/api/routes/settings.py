from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from core.auth import get_current_user
from database import get_db
from models.user import User
from schemas.settings import MeResponse, UpdateProfileRequest, ChangePasswordRequest
from core.auth import get_current_user, hash_password, verify_password

router = APIRouter(prefix="/settings", tags=["settings"])

def _get_db_user(db: Session, username: str) -> User:
    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@router.get("/me", response_model=MeResponse)
def get_me(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user = _get_db_user(db, current_user["username"])
    return {
        "full_name": user.full_name,
        "username": user.username,
        "email": user.email,
        "role": user.role,
    }

@router.patch("/profile")
def update_profile(
    body: UpdateProfileRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user = _get_db_user(db, current_user["username"])

    clean_name = body.full_name.strip()
    if not clean_name:
        raise HTTPException(status_code=400, detail="Full name cannot be empty")

    user.full_name = clean_name
    db.commit()

    return {"message": "Profile updated successfully"}

@router.patch("/password")
def change_password(
    body: ChangePasswordRequest,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user = _get_db_user(db, current_user["username"])

    stored_hash = user.password_hash or user.password
    if not verify_password(body.current_password, stored_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    if len(body.new_password) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters")

    new_hash = hash_password(body.new_password)
    user.password = new_hash
    user.password_hash = new_hash
    db.commit()

    return {"message": "Password changed successfully"}