from datetime import date, datetime

from pydantic import BaseModel


class ConsultationSummary(BaseModel):
    id: int
    status: str
    doctor_name: str | None
    created_at: datetime
    completed_at: datetime | None


class PrescriptionItemOut(BaseModel):
    drug_name: str
    dosage: str
    frequency: str
    duration: str | None
    notes: str | None


class ConsultationDetailOut(BaseModel):
    id: int
    status: str
    doctor_name: str | None
    chief_complaint: str
    screening_score: int
    screening_result: str
    note_text: str | None
    prescription_items: list[PrescriptionItemOut]
    follow_up_date: date | None
    follow_up_instructions: str | None
    referral_to: str | None
    referral_reason: str | None
    created_at: datetime
    completed_at: datetime | None