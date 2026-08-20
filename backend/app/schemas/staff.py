from datetime import datetime

from pydantic import BaseModel, EmailStr, Field

from app.models.user import UserRole


class StaffCreateRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    full_name: str = Field(min_length=1, max_length=255)
    role: UserRole
    license_number: str | None = None
    specialization: str | None = None


class StaffResponse(BaseModel):
    id: int
    email: str
    full_name: str
    role: str
    created_at: datetime