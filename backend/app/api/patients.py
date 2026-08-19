from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.database import get_db
from app.models.user import User, UserRole
from app.models.patient import Patient
from app.schemas.patient import PatientRegisterRequest, PatientResponse
from app.core.security import hash_password

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