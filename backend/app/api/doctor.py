from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User, UserRole
from app.models.consultation import Consultation, ConsultationStatus
from app.models.patient import Patient
from app.models.screening import Screening
from app.schemas.doctor_consultation import QueueItem, ConsultationDetail
from app.core.security import require_role
from app.models.consultation_note import ConsultationNote
from app.models.prescription import Prescription, PrescriptionItem
from app.models.follow_up import FollowUp
from app.models.referral import Referral
from app.schemas.end_consultation import EndConsultationRequest, EndConsultationResponse


router = APIRouter(prefix="/doctors", tags=["doctors"])


@router.get("/queue", response_model=list[QueueItem])
def list_queue(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.DOCTOR)),
):
    rows = (
        db.query(Consultation, Patient, Screening)
        .join(Patient, Consultation.patient_id == Patient.id)
        .join(Screening, Screening.consultation_id == Consultation.id)
        .filter(Consultation.status == ConsultationStatus.READY, Consultation.doctor_id.is_(None))
        .order_by(Consultation.created_at.asc())
        .all()
    )

    return [
        QueueItem(
            consultation_id=c.id,
            patient_name=p.full_name,
            screening_score=s.total_score,
            screening_result=s.result_category,
            ready_since=c.created_at,
        )
        for c, p, s in rows
    ]


@router.post("/consultations/{consultation_id}/claim", response_model=ConsultationDetail)
def claim_consultation(
    consultation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.DOCTOR)),
):
    updated_rows = (
        db.query(Consultation)
        .filter(
            Consultation.id == consultation_id,
            Consultation.status == ConsultationStatus.READY,
            Consultation.doctor_id.is_(None),
        )
        .update(
            {
                "doctor_id": current_user.doctor.id,
                "status": ConsultationStatus.ACTIVE,
                "started_at": datetime.now(timezone.utc),
            },
            synchronize_session=False,
        )
    )

    if updated_rows == 0:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This consultation was already claimed or is no longer available",
        )

    db.commit()

    return _get_detail(consultation_id, current_user, db)


@router.get("/consultations/mine", response_model=list[ConsultationDetail])
def list_my_consultations(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.DOCTOR)),
):
    rows = (
        db.query(Consultation, Patient, Screening)
        .join(Patient, Consultation.patient_id == Patient.id)
        .join(Screening, Screening.consultation_id == Consultation.id)
        .filter(
            Consultation.doctor_id == current_user.doctor.id,
            Consultation.status == ConsultationStatus.ACTIVE,
        )
        .order_by(Consultation.started_at.desc())
        .all()
    )

    return [
        ConsultationDetail(
            id=c.id,
            status=c.status.value,
            patient_name=p.full_name,
            chief_complaint=s.chief_complaint,
            screening_score=s.total_score,
            screening_result=s.result_category,
            started_at=c.started_at,
        )
        for c, p, s in rows
    ]


@router.get("/consultations/{consultation_id}", response_model=ConsultationDetail)
def get_consultation_detail(
    consultation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.DOCTOR)),
):
    return _get_detail(consultation_id, current_user, db)


def _get_detail(consultation_id: int, current_user: User, db: Session) -> ConsultationDetail:
    result = (
        db.query(Consultation, Patient, Screening)
        .join(Patient, Consultation.patient_id == Patient.id)
        .join(Screening, Screening.consultation_id == Consultation.id)
        .filter(Consultation.id == consultation_id)
        .first()
    )

    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Consultation not found")

    consultation, patient, screening = result

    if consultation.doctor_id != current_user.doctor.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your consultation")

    return ConsultationDetail(
        id=consultation.id,
        status=consultation.status.value,
        patient_name=patient.full_name,
        chief_complaint=screening.chief_complaint,
        screening_score=screening.total_score,
        screening_result=screening.result_category,
        started_at=consultation.started_at,
    )

@router.post("/consultations/{consultation_id}/end", response_model=EndConsultationResponse)
def end_consultation(
    consultation_id: int,
    payload: EndConsultationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.DOCTOR)),
):
    now = datetime.now(timezone.utc)

    updated_rows = (
        db.query(Consultation)
        .filter(
            Consultation.id == consultation_id,
            Consultation.doctor_id == current_user.doctor.id,
            Consultation.status == ConsultationStatus.ACTIVE,
        )
        .update(
            {"status": ConsultationStatus.COMPLETED, "completed_at": now},
            synchronize_session=False,
        )
    )

    if updated_rows == 0:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Consultation is not active, or is not assigned to you",
        )

    db.add(ConsultationNote(
        consultation_id=consultation_id,
        doctor_id=current_user.doctor.id,
        note_text=payload.note_text,
    ))

    if payload.prescription_items:
        prescription = Prescription(consultation_id=consultation_id)
        db.add(prescription)
        db.flush()

        for item in payload.prescription_items:
            db.add(PrescriptionItem(
                prescription_id=prescription.id,
                drug_name=item.drug_name,
                dosage=item.dosage,
                frequency=item.frequency,
                duration=item.duration,
                notes=item.notes,
            ))

    if payload.follow_up:
        db.add(FollowUp(
            consultation_id=consultation_id,
            follow_up_date=payload.follow_up.follow_up_date,
            instructions=payload.follow_up.instructions,
        ))

    if payload.referral:
        db.add(Referral(
            consultation_id=consultation_id,
            referred_to=payload.referral.referred_to,
            reason=payload.referral.reason,
        ))

    db.commit()

    return EndConsultationResponse(id=consultation_id, status="completed", completed_at=now)