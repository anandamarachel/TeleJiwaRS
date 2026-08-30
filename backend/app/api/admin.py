import os
from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User, UserRole
from app.models.payment import Payment, PaymentStatus
from app.models.consultation import Consultation, ConsultationStatus
from app.models.patient import Patient
from app.models.admin import Admin
from app.schemas.payment import (
    PAYMENT_REJECTION_LABELS,
    PaymentDecisionResponse,
    PaymentHistoryItem,
    PaymentHistoryResponse,
    PaymentQueueItem,
    PaymentRejectRequest,
    PaymentRejectionReason,
)
from app.core.security import require_role, get_current_user
from app.core.config import settings
from app.models.notification import Notification
from app.core.phone import normalize_indonesian_phone
from urllib.parse import quote

router = APIRouter(prefix="/admin/payments", tags=["admin"])


def _rejection_reason_label(code: str | None) -> str | None:
    if not code:
        return None
    try:
        return PAYMENT_REJECTION_LABELS[PaymentRejectionReason(code)]
    except ValueError:
        return "Pembayaran belum dapat diverifikasi"


@router.get("/pending", response_model=list[PaymentQueueItem])
def list_pending_payments(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    rows = (
        db.query(Payment, Patient)
        .join(Consultation, Payment.consultation_id == Consultation.id)
        .join(Patient, Consultation.patient_id == Patient.id)
        .filter(Payment.status == PaymentStatus.PENDING)
        .order_by(Payment.uploaded_at.asc())
        .all()
    )

    return [
        PaymentQueueItem(
            payment_id=payment.id,
            consultation_id=payment.consultation_id,
            patient_name=patient.full_name,
            amount=payment.amount,
            uploaded_at=payment.uploaded_at,
        )
        for payment, patient in rows
    ]


@router.get("/history", response_model=PaymentHistoryResponse)
def list_payment_history(
    payment_status: Literal["approved", "rejected"] | None = Query(default=None, alias="status"),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    query = (
        db.query(Payment, Patient, Admin)
        .join(Consultation, Payment.consultation_id == Consultation.id)
        .join(Patient, Consultation.patient_id == Patient.id)
        .outerjoin(Admin, Payment.verified_by_admin_id == Admin.id)
        .filter(Payment.status.in_([PaymentStatus.APPROVED, PaymentStatus.REJECTED]))
    )
    if payment_status:
        query = query.filter(Payment.status == PaymentStatus(payment_status))

    total = query.count()
    rows = (
        query.order_by(Payment.verified_at.desc(), Payment.id.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    return PaymentHistoryResponse(
        items=[
            PaymentHistoryItem(
                payment_id=payment.id,
                consultation_id=payment.consultation_id,
                patient_name=patient.full_name,
                patient_nik=patient.nik,
                amount=payment.amount,
                status=payment.status.value,
                uploaded_at=payment.uploaded_at,
                verified_at=payment.verified_at,
                verified_by=admin.full_name if admin else None,
                rejection_reason=_rejection_reason_label(payment.rejection_reason_code),
                rejection_note=payment.rejection_note,
            )
            for payment, patient, admin in rows
        ],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/{payment_id}/proof")
def get_payment_proof(
    payment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    payment = db.query(Payment).filter(Payment.id == payment_id).first()
    if payment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment not found")

    consultation = db.query(Consultation).filter(Consultation.id == payment.consultation_id).first()

    is_owner = (
        current_user.role == UserRole.PATIENT
        and current_user.patient
        and consultation.patient_id == current_user.patient.id
    )
    is_admin = current_user.role == UserRole.ADMIN

    if not (is_owner or is_admin):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to view this file")

    absolute_path = os.path.join(settings.upload_dir, payment.proof_file_path)
    if not os.path.exists(absolute_path):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File missing on server")

    return FileResponse(absolute_path)


@router.post("/{payment_id}/approve", response_model=PaymentDecisionResponse)
def approve_payment(
    payment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    now = datetime.now(timezone.utc)
    updated_rows = (
        db.query(Payment)
        .filter(Payment.id == payment_id, Payment.status == PaymentStatus.PENDING)
        .update(
            {
                "status": PaymentStatus.APPROVED,
                "verified_at": now,
                "verified_by_admin_id": current_user.admin.id,
            },
            synchronize_session=False,
        )
    )

    if updated_rows == 0:
        db.rollback()
        exists = db.query(Payment.id).filter(Payment.id == payment_id).first()
        if exists is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment not found")
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Payment is no longer pending")

    payment = db.query(Payment).filter(Payment.id == payment_id).first()

    consultation = db.query(Consultation).filter(Consultation.id == payment.consultation_id).first()
    patient = db.query(Patient).filter(Patient.id == consultation.patient_id).first()

    consultation.status = ConsultationStatus.READY

    message_text = (
        f"Halo {patient.full_name}, pembayaran konsultasi Anda telah dikonfirmasi. "
        f"Silakan kembali ke aplikasi Telemedicine Jiwa untuk memulai konsultasi Anda."
    )

    notification = Notification(
        consultation_id=consultation.id,
        message_text=message_text,
        generated_by_admin_id=current_user.admin.id,
    )
    db.add(notification)

    db.commit()
    db.refresh(payment)

    phone_number = normalize_indonesian_phone(patient.phone_number)
    whatsapp_link = f"https://wa.me/{phone_number}?text={quote(message_text)}"

    return PaymentDecisionResponse(
        payment_id=payment.id,
        status=payment.status.value,
        verified_at=payment.verified_at,
        whatsapp_link=whatsapp_link,
    )


@router.post("/{payment_id}/reject", response_model=PaymentDecisionResponse)
def reject_payment(
    payment_id: int,
    payload: PaymentRejectRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    now = datetime.now(timezone.utc)
    reason_label = PAYMENT_REJECTION_LABELS[payload.reason]
    updated_rows = (
        db.query(Payment)
        .filter(Payment.id == payment_id, Payment.status == PaymentStatus.PENDING)
        .update(
            {
                "status": PaymentStatus.REJECTED,
                "verified_at": now,
                "verified_by_admin_id": current_user.admin.id,
                "rejection_reason_code": payload.reason.value,
                "rejection_note": payload.note,
            },
            synchronize_session=False,
        )
    )

    if updated_rows == 0:
        db.rollback()
        exists = db.query(Payment.id).filter(Payment.id == payment_id).first()
        if exists is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment not found")
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Payment is no longer pending")

    payment = db.query(Payment).filter(Payment.id == payment_id).first()

    consultation = db.query(Consultation).filter(Consultation.id == payment.consultation_id).first()
    patient = db.query(Patient).filter(Patient.id == consultation.patient_id).first()

    consultation.status = ConsultationStatus.PAYMENT_REJECTED

    reason_sentence = reason_label
    if payload.note:
        reason_sentence = f"{reason_sentence}. Catatan: {payload.note}"
    message_text = (
        f"Halo {patient.full_name}, pembayaran untuk konsultasi #{consultation.id} belum dapat "
        f"kami verifikasi. Alasan: {reason_sentence}. Silakan kembali ke aplikasi Telemedicine "
        "Jiwa dan unggah ulang bukti pembayaran."
    )
    db.add(
        Notification(
            consultation_id=consultation.id,
            message_text=message_text,
            generated_by_admin_id=current_user.admin.id,
        )
    )

    db.commit()
    db.refresh(payment)

    phone_number = normalize_indonesian_phone(patient.phone_number)
    whatsapp_link = f"https://wa.me/{phone_number}?text={quote(message_text)}"

    return PaymentDecisionResponse(
        payment_id=payment.id,
        status=payment.status.value,
        verified_at=payment.verified_at,
        whatsapp_link=whatsapp_link,
        rejection_reason=reason_label,
        rejection_note=payload.note,
    )
