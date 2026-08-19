# app/schemas/patient.py
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class PatientRegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    full_name: str = Field(min_length=1, max_length=255)
    phone_number: str = Field(min_length=8, max_length=20)


class PatientResponse(BaseModel):
    id: int
    email: str
    full_name: str
    phone_number: str
    created_at: datetime

    class Config:
        from_attributes = True