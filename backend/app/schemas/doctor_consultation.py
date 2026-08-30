from datetime import datetime

from pydantic import BaseModel


class PublicDoctorProfile(BaseModel):
    id: int
    full_name: str
    specialization: str | None
    photo_url: str | None


class AdminDoctorProfile(PublicDoctorProfile):
    email: str
    license_number: str
    is_active: bool


class QueueItem(BaseModel):
    consultation_id: int
    patient_name: str
    screening_score: int
    screening_result: str
    ready_since: datetime


class ConsultationDetail(BaseModel):
    id: int
    status: str
    patient_name: str
    chief_complaint: str
    screening_score: int
    screening_result: str
    started_at: datetime | None
