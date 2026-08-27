from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel


class PaymentResponse(BaseModel):
    id: int
    consultation_id: int
    amount: Decimal
    status: str
    uploaded_at: datetime


class PaymentInstructionsResponse(BaseModel):
    consultation_id: int
    amount: Decimal
    consultation_status: str
    bank_name: str
    bank_account_number: str
    bank_account_holder: str


class PaymentQueueItem(BaseModel):
    payment_id: int
    consultation_id: int    
    patient_name: str
    amount: Decimal
    uploaded_at: datetime


class PaymentDecisionResponse(BaseModel):
    payment_id: int
    status: str
    verified_at: datetime
    whatsapp_link: str | None = None
