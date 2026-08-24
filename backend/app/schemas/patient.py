from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field
from pydantic import field_validator
from app.core.phone import normalize_indonesian_phone


class PatientRegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    full_name: str = Field(min_length=1, max_length=255)
    phone_number: str = Field(min_length=8, max_length=20)

    @field_validator("phone_number")
    @classmethod
    def normalize_phone(cls, v: str) -> str:
        return normalize_indonesian_phone(v)


class PatientResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    full_name: str
    phone_number: str
    created_at: datetime
