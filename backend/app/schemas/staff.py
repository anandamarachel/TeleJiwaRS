from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, field_validator

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


class StaffListItem(StaffResponse):
    is_active: bool
    is_super_admin: bool = False
    doctor_id: int | None = None
    license_number: str | None = None
    specialization: str | None = None
    photo_url: str | None = None


class DoctorStaffUpdateRequest(BaseModel):
    full_name: str = Field(min_length=1, max_length=255)

    @field_validator("full_name")
    @classmethod
    def normalize_full_name(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Nama dokter wajib diisi")
        return value
