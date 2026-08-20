from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.database import get_db
from app.models.user import User, UserRole
from app.models.doctor import Doctor
from app.models.admin import Admin
from app.schemas.staff import StaffCreateRequest, StaffResponse
from app.core.security import hash_password, require_role

router = APIRouter(prefix="/staff", tags=["staff"])


@router.post("/create", response_model=StaffResponse, status_code=status.HTTP_201_CREATED)
def create_staff(
    payload: StaffCreateRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_role(UserRole.ADMIN)),
):
    if payload.role not in (UserRole.DOCTOR, UserRole.ADMIN):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This endpoint can only create doctor or admin accounts",
        )

    if payload.role == UserRole.DOCTOR and not payload.license_number:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="license_number is required for doctor accounts",
        )

    user = User(
        email=payload.email,
        password_hash=hash_password(payload.password),
        role=payload.role,
    )

    try:
        db.add(user)
        db.flush()

        if payload.role == UserRole.DOCTOR:
            profile = Doctor(
                user_id=user.id,
                full_name=payload.full_name,
                license_number=payload.license_number,
                specialization=payload.specialization,
            )
        else:
            profile = Admin(user_id=user.id, full_name=payload.full_name)

        db.add(profile)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email or license number already in use",
        )

    return StaffResponse(
        id=user.id,
        email=user.email,
        full_name=payload.full_name,
        role=user.role.value,
        created_at=user.created_at,
    )