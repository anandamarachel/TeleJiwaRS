from datetime import datetime
from decimal import Decimal
from enum import Enum

from pydantic import BaseModel, Field, field_validator, model_validator


class PaymentRejectionReason(str, Enum):
    PROOF_UNREADABLE = "proof_unreadable"
    AMOUNT_MISMATCH = "amount_mismatch"
    WRONG_DESTINATION = "wrong_destination"
    INCOMPLETE_INFORMATION = "incomplete_information"
    PAYMENT_NOT_FOUND = "payment_not_found"
    OTHER = "other"


PAYMENT_REJECTION_LABELS = {
    PaymentRejectionReason.PROOF_UNREADABLE: "Bukti pembayaran tidak terbaca",
    PaymentRejectionReason.AMOUNT_MISMATCH: "Nominal pembayaran tidak sesuai",
    PaymentRejectionReason.WRONG_DESTINATION: "Rekening tujuan tidak sesuai",
    PaymentRejectionReason.INCOMPLETE_INFORMATION: "Informasi transaksi tidak lengkap",
    PaymentRejectionReason.PAYMENT_NOT_FOUND: "Pembayaran belum ditemukan",
    PaymentRejectionReason.OTHER: "Alasan lainnya",
}


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


class PaymentHistoryItem(BaseModel):
    payment_id: int
    consultation_id: int
    patient_name: str
    patient_nik: str | None
    amount: Decimal
    status: str
    uploaded_at: datetime
    verified_at: datetime
    verified_by: str | None
    rejection_reason: str | None = None
    rejection_note: str | None = None


class PaymentHistoryResponse(BaseModel):
    items: list[PaymentHistoryItem]
    total: int
    limit: int
    offset: int


class PaymentRejectRequest(BaseModel):
    reason: PaymentRejectionReason
    note: str | None = Field(default=None, max_length=500)

    @field_validator("note")
    @classmethod
    def normalize_note(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        return value or None

    @model_validator(mode="after")
    def require_note_for_other_reason(self):
        if self.reason == PaymentRejectionReason.OTHER and not self.note:
            raise ValueError("Catatan wajib diisi untuk alasan lainnya")
        return self


class PaymentDecisionResponse(BaseModel):
    payment_id: int
    status: str
    verified_at: datetime
    whatsapp_link: str | None = None
    rejection_reason: str | None = None
    rejection_note: str | None = None
