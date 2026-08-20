from datetime import date, datetime

from pydantic import BaseModel, Field


class PrescriptionItemInput(BaseModel):
    drug_name: str = Field(min_length=1, max_length=255)
    dosage: str = Field(min_length=1, max_length=100)
    frequency: str = Field(min_length=1, max_length=100)
    duration: str | None = None
    notes: str | None = None


class FollowUpInput(BaseModel):
    follow_up_date: date
    instructions: str | None = None


class ReferralInput(BaseModel):
    referred_to: str = Field(min_length=1, max_length=255)
    reason: str = Field(min_length=1)


class EndConsultationRequest(BaseModel):
    note_text: str = Field(min_length=1)
    prescription_items: list[PrescriptionItemInput] | None = None
    follow_up: FollowUpInput | None = None
    referral: ReferralInput | None = None


class EndConsultationResponse(BaseModel):
    id: int
    status: str
    completed_at: datetime