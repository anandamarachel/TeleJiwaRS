from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.database import get_db
from app.models.user import User, UserRole
from app.models.doctor import Doctor
from app.models.admin import Admin
from app.schemas.staff import DoctorStaffUpdateRequest, StaffCreateRequest, StaffListItem, StaffResponse
from app.core.security import hash_password, require_super_admin
from app.models.consultation import Consultation, ConsultationStatus

router = APIRouter(prefix="/staff", tags=["staff"])


def _staff_item(request: Request, user: User) -> StaffListItem:
    profile = user.doctor if user.role == UserRole.DOCTOR else user.admin
    doctor = user.doctor
    photo_url = None
    if doctor and doctor.photo_file_path:
        photo_url = str(request.url_for("get_doctor_photo", doctor_id=doctor.id)) + f"?v={Path(doctor.photo_file_path).stem}"
    return StaffListItem(
        id=user.id,
        email=user.email,
        full_name=profile.full_name,
        role=user.role.value,
        created_at=user.created_at,
        is_active=user.is_active,
        is_super_admin=bool(user.admin and user.admin.is_super_admin),
        doctor_id=doctor.id if doctor else None,
        license_number=doctor.license_number if doctor else None,
        specialization=doctor.specialization if doctor else None,
        photo_url=photo_url,
    )


@router.get("", response_model=list[StaffListItem])
def list_staff(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_super_admin),
):
    users = (
        db.query(User)
        .filter(User.role.in_([UserRole.DOCTOR, UserRole.ADMIN]))
        .order_by(User.role.asc(), User.created_at.asc())
        .all()
    )
    return [_staff_item(request, user) for user in users]


@router.post("/create", response_model=StaffResponse, status_code=status.HTTP_201_CREATED)
def create_staff(
    payload: StaffCreateRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_super_admin),
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
            profile = Admin(user_id=user.id, full_name=payload.full_name, is_super_admin=False)

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


@router.patch("/{user_id}", response_model=StaffListItem)
def update_doctor_staff(
    user_id: int,
    payload: DoctorStaffUpdateRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_super_admin),
):
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Staff not found")
    if user.role != UserRole.DOCTOR or user.doctor is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only doctor profiles can be edited")

    user.doctor.full_name = payload.full_name.strip()
    db.commit()
    db.refresh(user.doctor)
    return _staff_item(request, user)


@router.delete("/{user_id}", response_model=StaffListItem)
def deactivate_staff(
    user_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_super_admin),
):
    user = db.query(User).filter(User.id == user_id).first()
    if user is None or user.role not in (UserRole.DOCTOR, UserRole.ADMIN):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Staff not found")
    if user.id == current_user.id:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Anda tidak dapat menghapus akses akun sendiri")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Akses staf sudah dinonaktifkan")

    if user.role == UserRole.ADMIN and user.admin and user.admin.is_super_admin:
        active_super_admin_count = (
            db.query(Admin.id)
            .join(User, Admin.user_id == User.id)
            .filter(Admin.is_super_admin.is_(True), User.is_active.is_(True))
            .count()
        )
        if active_super_admin_count <= 1:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Minimal satu Admin Utama aktif harus tetap tersedia")
    elif user.doctor:
        active_consultation = (
            db.query(Consultation.id)
            .filter(
                Consultation.doctor_id == user.doctor.id,
                Consultation.status == ConsultationStatus.ACTIVE,
            )
            .first()
        )
        if active_consultation:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Dokter masih menangani konsultasi aktif")

    user.is_active = False
    db.commit()
    db.refresh(user)
    return _staff_item(request, user)


@router.post("/{user_id}/restore", response_model=StaffListItem)
def restore_staff_access(
    user_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_super_admin),
):
    user = db.query(User).filter(User.id == user_id).first()
    if user is None or user.role not in (UserRole.DOCTOR, UserRole.ADMIN):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Staff not found")
    if user.is_active:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Akses staf masih aktif")
    user.is_active = True
    db.commit()
    db.refresh(user)
    return _staff_item(request, user)
