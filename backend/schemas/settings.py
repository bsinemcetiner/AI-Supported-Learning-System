from pydantic import BaseModel

class MeResponse(BaseModel):
    full_name: str
    username: str
    email: str | None = None
    role: str

class UpdateProfileRequest(BaseModel):
    full_name: str

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str