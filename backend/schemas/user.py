from pydantic import BaseModel


class UserCreate(BaseModel):
    full_name: str
    username: str
    password: str
    role: str


class UserOut(BaseModel):
    username: str
    full_name: str
    role: str

    class Config:
        from_attributes = True