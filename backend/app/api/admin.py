import os
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User, UserRole
from app.models.payment import Payment, PaymentStatus
from app.models.consultation import Consultation, ConsultationStatus
from app.models.patient import Patient
from app.schemas.payment import PaymentQueueItem, PaymentDecisionResponse
from app.core.security import require_role, get_current_user
from app.core.config import settings
from app.models.notification import Notification
from urllib.parse import quote

router = APIRouter(prefix="/admin/payments", tags=["admin"])


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
    payment = db.query(Payment).filter(Payment.id == payment_id).first()
    if payment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment not found")

    if payment.status != PaymentStatus.PENDING:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Payment is not pending")

    consultation = db.query(Consultation).filter(Consultation.id == payment.consultation_id).first()
    patient = db.query(Patient).filter(Patient.id == consultation.patient_id).first()

    payment.status = PaymentStatus.APPROVED
    payment.verified_at = datetime.now(timezone.utc)
    payment.verified_by_admin_id = current_user.admin.id
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

    whatsapp_link = f"https://wa.me/{patient.phone_number}?text={quote(message_text)}"

    return PaymentDecisionResponse(
        payment_id=payment.id,
        status=payment.status.value,
        verified_at=payment.verified_at,
        whatsapp_link=whatsapp_link,
    )


@router.post("/{payment_id}/reject", response_model=PaymentDecisionResponse)
def reject_payment(
    payment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    payment = db.query(Payment).filter(Payment.id == payment_id).first()
    if payment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment not found")

    if payment.status != PaymentStatus.PENDING:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Payment is not pending")

    consultation = db.query(Consultation).filter(Consultation.id == payment.consultation_id).first()

    payment.status = PaymentStatus.REJECTED
    payment.verified_at = datetime.now(timezone.utc)
    payment.verified_by_admin_id = current_user.admin.id
    consultation.status = ConsultationStatus.PAYMENT_REJECTED

    db.commit()
    db.refresh(payment)

    return PaymentDecisionResponse(
        payment_id=payment.id,
        status=payment.status.value,
        verified_at=payment.verified_at,
    )