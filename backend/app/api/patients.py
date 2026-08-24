from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.database import get_db
from app.models.user import User, UserRole
from app.models.patient import Patient
from app.schemas.patient import PatientRegisterRequest, PatientResponse
from app.core.security import hash_password
from app.models.consultation import Consultation
from app.models.doctor import Doctor
from app.models.screening import Screening
from app.models.consultation_note import ConsultationNote
from app.models.prescription import Prescription, PrescriptionItem
from app.models.follow_up import FollowUp
from app.models.referral import Referral
from app.schemas.patient_consultation import ConsultationSummary, ConsultationDetailOut, PrescriptionItemOut
from app.core.security import require_role

router = APIRouter(prefix="/patients", tags=["patients"])


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
        )
        db.add(patient)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email or phone number already registered",
        )

    db.refresh(patient)
    return PatientResponse(
        id=patient.id,
        email=user.email,
        full_name=patient.full_name,
        phone_number=patient.phone_number,
        created_at=patient.created_at,
    )

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

    return [
        ConsultationSummary(
            id=c.id,
            status=c.status.value,
            screening_submitted=c.screening is not None,
            doctor_name=d.full_name if d else None,
            created_at=c.created_at,
            completed_at=c.completed_at,
        )
        for c, d in rows
    ]


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
