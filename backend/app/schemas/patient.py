from datetime import datetime
import re

from pydantic import BaseModel, ConfigDict, EmailStr, Field
from pydantic import field_validator, model_validator
from app.core.phone import normalize_indonesian_phone


class PatientRegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    full_name: str = Field(min_length=1, max_length=255)
    phone_number: str = Field(min_length=8, max_length=20)
    nik: str

    @field_validator("phone_number")
    @classmethod
    def normalize_phone(cls, v: str) -> str:
        return normalize_indonesian_phone(v)

    @field_validator("nik")
    @classmethod
    def validate_nik(cls, v: str) -> str:
        value = re.sub(r"[\s-]", "", v)
        if not re.fullmatch(r"\d{16}", value):
            raise ValueError("NIK harus terdiri dari 16 digit angka")
        return value


class PatientResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    full_name: str
    phone_number: str
    nik: str | None
    created_at: datetime


class PatientProfileUpdateRequest(BaseModel):
    email: EmailStr
    email_confirmation: EmailStr
    full_name: str = Field(min_length=1, max_length=255)
    phone_number: str = Field(min_length=8, max_length=20)
    nik: str
    nik_confirmation: str
    current_password: str | None = Field(default=None, min_length=1, max_length=255)

    @field_validator("email", "email_confirmation", mode="before")
    @classmethod
    def normalize_email(cls, v: str) -> str:
        return v.strip().lower()

    @field_validator("full_name")
    @classmethod
    def normalize_full_name(cls, v: str) -> str:
        value = v.strip()
        if not value:
            raise ValueError("Nama lengkap wajib diisi")
        return value

    @field_validator("phone_number")
    @classmethod
    def normalize_updated_phone(cls, v: str) -> str:
        return normalize_indonesian_phone(v)

    @field_validator("nik", "nik_confirmation")
    @classmethod
    def validate_updated_nik(cls, v: str) -> str:
        value = re.sub(r"[\s-]", "", v)
        if not re.fullmatch(r"\d{16}", value):
            raise ValueError("NIK harus terdiri dari 16 digit angka")
        return value

    @model_validator(mode="after")
    def validate_sensitive_confirmations(self):
        if self.email != self.email_confirmation:
            raise ValueError("Konfirmasi email tidak cocok")
        if self.nik != self.nik_confirmation:
            raise ValueError("Konfirmasi NIK tidak cocok")
        return self


class PatientAccountDeleteRequest(BaseModel):
    password: str = Field(min_length=1)
