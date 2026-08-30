import secrets

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.database import get_db
from app.models.user import User, UserRole
from app.models.patient import Patient
from app.schemas.patient import (
    PatientAccountDeleteRequest,
    PatientProfileUpdateRequest,
    PatientRegisterRequest,
    PatientResponse,
)
from app.core.security import hash_password, verify_password
from app.models.consultation import Consultation, ConsultationStatus
from app.models.payment import Payment, PaymentStatus
from app.models.patient_profile_change import PatientProfileChange
from app.models.doctor import Doctor
from app.models.screening import Screening
from app.models.consultation_note import ConsultationNote
from app.models.prescription import Prescription, PrescriptionItem
from app.models.follow_up import FollowUp
from app.models.referral import Referral
from app.schemas.patient_consultation import ConsultationSummary, ConsultationDetailOut, PrescriptionItemOut
from app.core.security import require_role
from app.schemas.payment import PAYMENT_REJECTION_LABELS, PaymentRejectionReason

router = APIRouter(prefix="/patients", tags=["patients"])


def _mask_email(value: str) -> str:
    local, _, domain = value.partition("@")
    return f"{local[:1]}***@{domain}" if domain else "***"


def _mask_nik(value: str | None) -> str | None:
    if not value:
        return None
    return f"************{value[-4:]}"


def _patient_response(user: User) -> PatientResponse:
    return PatientResponse(
        id=user.patient.id,
        email=user.email,
        full_name=user.patient.full_name,
        phone_number=user.patient.phone_number,
        nik=user.patient.nik,
        created_at=user.patient.created_at,
    )


@router.post("/register", response_model=PatientResponse, status_code=status.HTTP_201_CREATED)
def register_patient(payload: PatientRegisterRequest, db: Session = Depends(get_db)):
    user = User(
        email=payload.email,
        password_hash=hash_password(payload.password),
        role=UserRole.PATIENT,
    )

    try:
        db.add(user)
        db.flush()  # assigns user.id, and is where a duplicate email would fail

        patient = Patient(
            user_id=user.id,
            full_name=payload.full_name,
            phone_number=payload.phone_number,
            nik=payload.nik,
        )
        db.add(patient)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email, nomor WhatsApp, atau NIK sudah terdaftar",
        )

    db.refresh(patient)
    return PatientResponse(
        id=patient.id,
        email=user.email,
        full_name=patient.full_name,
        phone_number=patient.phone_number,
        nik=patient.nik,
        created_at=patient.created_at,
    )


@router.get("/me", response_model=PatientResponse)
def get_my_profile(
    current_user: User = Depends(require_role(UserRole.PATIENT)),
):
    return _patient_response(current_user)


@router.patch("/me", response_model=PatientResponse)
def update_my_profile(
    payload: PatientProfileUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.PATIENT)),
):
    new_email = str(payload.email)
    email_changed = new_email != current_user.email
    nik_changed = payload.nik != current_user.patient.nik
    if email_changed or nik_changed:
        if not payload.current_password or not verify_password(payload.current_password, current_user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Kata sandi saat ini diperlukan dan harus sesuai untuk mengubah email atau NIK",
            )

    if nik_changed and current_user.patient.nik is not None:
        has_consultation_history = (
            db.query(Consultation.id)
            .filter(Consultation.patient_id == current_user.patient.id)
            .first()
            is not None
        )
        if has_consultation_history:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="NIK tidak dapat diubah setelah pasien memiliki riwayat konsultasi",
            )

    if email_changed:
        db.add(
            PatientProfileChange(
                patient_id=current_user.patient.id,
                field_name="email",
                old_value_masked=_mask_email(current_user.email),
                new_value_masked=_mask_email(new_email),
            )
        )
    if nik_changed:
        db.add(
            PatientProfileChange(
                patient_id=current_user.patient.id,
                field_name="nik",
                old_value_masked=_mask_nik(current_user.patient.nik),
                new_value_masked=_mask_nik(payload.nik),
            )
        )

    current_user.email = new_email
    current_user.patient.full_name = payload.full_name
    current_user.patient.phone_number = payload.phone_number
    current_user.patient.nik = payload.nik

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email, nomor WhatsApp, atau NIK sudah digunakan akun lain",
        )

    db.refresh(current_user)
    db.refresh(current_user.patient)
    return _patient_response(current_user)


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
def delete_my_account(
    payload: PatientAccountDeleteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.PATIENT)),
):
    if not verify_password(payload.password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Kata sandi tidak sesuai",
        )

    has_open_consultation = (
        db.query(Consultation.id)
        .filter(
            Consultation.patient_id == current_user.patient.id,
            Consultation.status != ConsultationStatus.COMPLETED,
        )
        .first()
        is not None
    )
    if has_open_consultation:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Akun tidak dapat dihapus selama masih ada konsultasi yang berjalan",
        )

    anonymization_token = secrets.token_hex(8)
    current_user.email = f"deleted-{current_user.id}-{anonymization_token}@deleted.invalid"
    current_user.password_hash = hash_password(secrets.token_urlsafe(32))
    current_user.is_active = False
    current_user.patient.full_name = "Akun Pasien Dihapus"
    current_user.patient.phone_number = f"deleted{current_user.id}{anonymization_token}"[:20]
    current_user.patient.nik = None
    db.commit()

    response = Response(status_code=status.HTTP_204_NO_CONTENT)
    response.delete_cookie("access_token", path="/")
    return response

@router.get("/consultations", response_model=list[ConsultationSummary])
def list_my_consultations(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.PATIENT)),
):
    rows = (
        db.query(Consultation, Doctor)
        .outerjoin(Doctor, Consultation.doctor_id == Doctor.id)
        .filter(Consultation.patient_id == current_user.patient.id)
        .order_by(Consultation.created_at.desc())
        .all()
    )

    rejected_consultation_ids = [
        consultation.id
        for consultation, _ in rows
        if consultation.status == ConsultationStatus.PAYMENT_REJECTED
    ]
    latest_rejections: dict[int, Payment] = {}
    if rejected_consultation_ids:
        rejected_payments = (
            db.query(Payment)
            .filter(
                Payment.consultation_id.in_(rejected_consultation_ids),
                Payment.status == PaymentStatus.REJECTED,
            )
            .order_by(Payment.id.desc())
            .all()
        )
        for payment in rejected_payments:
            latest_rejections.setdefault(payment.consultation_id, payment)

    summaries = []
    for consultation, doctor in rows:
        rejection = latest_rejections.get(consultation.id)
        rejection_reason = None
        if rejection and rejection.rejection_reason_code:
            try:
                reason = PaymentRejectionReason(rejection.rejection_reason_code)
                rejection_reason = PAYMENT_REJECTION_LABELS[reason]
            except ValueError:
                rejection_reason = "Pembayaran belum dapat diverifikasi"

        summaries.append(ConsultationSummary(
            id=consultation.id,
            status=consultation.status.value,
            screening_submitted=consultation.screening is not None,
            doctor_name=doctor.full_name if doctor else None,
            payment_rejection_reason=rejection_reason,
            payment_rejection_note=rejection.rejection_note if rejection else None,
            created_at=consultation.created_at,
            completed_at=consultation.completed_at,
        )
        )
    return summaries


@router.get("/consultations/{consultation_id}", response_model=ConsultationDetailOut)
def get_my_consultation_detail(
    consultation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.PATIENT)),
):
    consultation = db.query(Consultation).filter(Consultation.id == consultation_id).first()

    if consultation is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Consultation not found")

    if consultation.patient_id != current_user.patient.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your consultation")

    doctor = db.query(Doctor).filter(Doctor.id == consultation.doctor_id).first() if consultation.doctor_id else None
    screening = db.query(Screening).filter(Screening.consultation_id == consultation_id).first()
    note = db.query(ConsultationNote).filter(ConsultationNote.consultation_id == consultation_id).first()
    prescription = db.query(Prescription).filter(Prescription.consultation_id == consultation_id).first()
    follow_up = db.query(FollowUp).filter(FollowUp.consultation_id == consultation_id).first()
    referral = db.query(Referral).filter(Referral.consultation_id == consultation_id).first()

    items = []
    if prescription:
        prescription_items = (
            db.query(PrescriptionItem).filter(PrescriptionItem.prescription_id == prescription.id).all()
        )
        items = [
            PrescriptionItemOut(
                drug_name=i.drug_name, dosage=i.dosage, frequency=i.frequency,
                duration=i.duration, notes=i.notes,
            )
            for i in prescription_items
        ]

    return ConsultationDetailOut(
        id=consultation.id,
        status=consultation.status.value,
        doctor_name=doctor.full_name if doctor else None,
        chief_complaint=screening.chief_complaint if screening else "",
        screening_score=screening.total_score if screening else 0,
        screening_result=screening.result_category if screening else "",
        note_text=note.note_text if note else None,
        prescription_items=items,
        follow_up_date=follow_up.follow_up_date if follow_up else None,
        follow_up_instructions=follow_up.instructions if follow_up else None,
        referral_to=referral.referred_to if referral else None,
        referral_reason=referral.reason if referral else None,
        created_at=consultation.created_at,
        completed_at=consultation.completed_at,
    )
