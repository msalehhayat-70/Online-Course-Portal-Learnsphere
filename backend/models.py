from pydantic import BaseModel, EmailStr, Field
from datetime import date
from typing import Optional

# Base User model
class BaseUser(BaseModel):
    full_name: str
    email: EmailStr
    password: str = Field(min_length=4)
    gender: str
    date_of_birth: date
    security_question: str
    security_answer: str

# Models for Registration
class StudentRegister(BaseUser):
    pass

class AdminRegister(BaseUser):
    admin_id: int

# Models for Login
class StudentLogin(BaseModel):
    email: EmailStr
    password: str

class AdminLogin(StudentLogin):
    admin_id: int

# Models for Dashboard actions
class CourseCreate(BaseModel):
    name: str
    description: str
    instructor: str

class ReviewCreate(BaseModel):
    course_name: str
    rating: int = Field(ge=1, le=5)
    comment: str

# Models for Responses
class Token(BaseModel):
    access_token: str
    token_type: str

class UserResponse(BaseModel):
    full_name: str
    email: EmailStr
    gender: str
    admin_id: Optional[int] = None
    
    class Config:
        orm_mode = True

        # models.py (add these at the end)

# Model to request the security question
class ForgotPasswordRequest(BaseModel):
    email: EmailStr

# Model to reset the password
class ResetPasswordRequest(BaseModel):
    email: EmailStr
    security_answer: str
    new_password: str = Field(min_length=4)

# In models.py, add this new class

class VerifyAnswerRequest(BaseModel):
    email: EmailStr
    security_answer: str