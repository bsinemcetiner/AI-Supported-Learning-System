from pydantic import BaseModel
from typing import Optional

class MeResponse(BaseModel):
    full_name: str
    username: str
    email: Optional[str] = None
    role: str

class UpdateProfileRequest(BaseModel):
    full_name: str

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str