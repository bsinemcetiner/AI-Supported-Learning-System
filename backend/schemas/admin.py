from pydantic import BaseModel

class AdminLogin(BaseModel):
    username: str
    password: str

class AdminOut(BaseModel):
    id: int
    username: str

    class Config:
        from_attributes = True

class AssignCourseRequest(BaseModel):
    student_id: int
    course_id: str

class RemoveCourseRequest(BaseModel):
    student_id: int
    course_id: str