from fastapi import APIRouter, Depends, HTTPException, status, Response
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.schemas.auth import LoginRequest, UserInfoResponse
from app.core.security import verify_password, create_access_token, get_current_user
from app.core.config import settings

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=UserInfoResponse)
def login(payload: LoginRequest, response: Response, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()

    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is deactivated")

    token = create_access_token(user_id=user.id, role=user.role.value)

    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        max_age=settings.access_token_expire_minutes * 60,
        path="/",
    )

    return UserInfoResponse(id=user.id, email=user.email, role=user.role.value)

@router.post("/logout")
def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    return {"message": "Logged out"}

@router.get("/me", response_model=UserInfoResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return UserInfoResponse(id=current_user.id, email=current_user.email, role=current_user.role.value)