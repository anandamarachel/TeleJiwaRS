from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User, UserRole
from app.models.consultation import Consultation
from app.schemas.consultation import ConsultationResponse
from app.core.security import require_role, get_current_user
from app.models.screening import Screening, ScreeningAnswer, ScreeningQuestion
from app.schemas.screening import ScreeningSubmitRequest, ScreeningResponse, ScreeningQuestionResponse
from app.core.screening_logic import calculate_result_category
from app.models.consultation import Consultation, ConsultationStatus
from app.core.config import settings
from app.models.chat_message import ChatMessage
from app.schemas.chat import ChatMessageResponse


import os
import uuid

from fastapi import UploadFile, File

from app.models.payment import Payment, PaymentStatus
from app.schemas.payment import PaymentResponse


router = APIRouter(prefix="/consultations", tags=["consultations"])


@router.post("/start", response_model=ConsultationResponse, status_code=status.HTTP_201_CREATED)
def start_consultation(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.PATIENT)),
):
    consultation = Consultation(patient_id=current_user.patient.id)
    db.add(consultation)
    db.commit()
    db.refresh(consultation)

    return ConsultationResponse(
        id=consultation.id,
        status=consultation.status.value,
        created_at=consultation.created_at,
    )

@router.get("/screening/questions", response_model=list[ScreeningQuestionResponse])
def list_screening_questions(db: Session = Depends(get_db)):
    questions = (
        db.query(ScreeningQuestion)
        .filter(ScreeningQuestion.is_active == True)
        .order_by(ScreeningQuestion.order_index)
        .all()
    )
    return questions


@router.post("/{consultation_id}/screening", response_model=ScreeningResponse, status_code=status.HTTP_201_CREATED)
def submit_screening(
    consultation_id: int,
    payload: ScreeningSubmitRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.PATIENT)),
):
    consultation = db.query(Consultation).filter(Consultation.id == consultation_id).first()

    if consultation is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Consultation not found")

    if consultation.patient_id != current_user.patient.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your consultation")

    if consultation.status != ConsultationStatus.SCREENING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Screening already submitted or consultation not in screening stage",
        )

    active_question_ids = {
        q.id for q in db.query(ScreeningQuestion).filter(ScreeningQuestion.is_active == True).all()
    }
    submitted_question_ids = {a.question_id for a in payload.answers}

    if submitted_question_ids != active_question_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Answers must cover exactly the current set of active screening questions",
        )

    total_score = sum(a.score_value for a in payload.answers)
    max_possible = len(active_question_ids) * 3
    result_category = calculate_result_category(total_score, max_possible)

    screening = Screening(
        consultation_id=consultation.id,
        chief_complaint=payload.chief_complaint,
        total_score=total_score,
        result_category=result_category,
    )
    db.add(screening)
    db.flush()

    for answer in payload.answers:
        db.add(ScreeningAnswer(
            screening_id=screening.id,
            question_id=answer.question_id,
            score_value=answer.score_value,
        ))

    db.commit()
    db.refresh(screening)

    return ScreeningResponse(
        id=screening.id,
        chief_complaint=screening.chief_complaint,
        total_score=screening.total_score,
        result_category=screening.result_category,
    )

ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "application/pdf"}
MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB


@router.post("/{consultation_id}/payment", response_model=PaymentResponse, status_code=status.HTTP_201_CREATED)
async def upload_payment_proof(
    consultation_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.PATIENT)),
):
    consultation = db.query(Consultation).filter(Consultation.id == consultation_id).first()

    if consultation is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Consultation not found")

    if consultation.patient_id != current_user.patient.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your consultation")

    if consultation.screening is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Complete screening before submitting payment",
        )

    if consultation.status not in (ConsultationStatus.SCREENING, ConsultationStatus.PAYMENT_REJECTED):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Payment cannot be submitted in the consultation's current state",
        )

    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be a JPEG, PNG, or PDF",
        )

    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File too large (max 5MB)")

    extension = os.path.splitext(file.filename)[1]
    unique_filename = f"{uuid.uuid4().hex}{extension}"
    relative_path = os.path.join("payment_proofs", str(consultation_id), unique_filename)
    absolute_path = os.path.join(settings.upload_dir, relative_path)

    os.makedirs(os.path.dirname(absolute_path), exist_ok=True)
    with open(absolute_path, "wb") as f:
        f.write(contents)

    payment = Payment(
        consultation_id=consultation.id,
        amount=settings.consultation_fee,
        proof_file_path=relative_path,
        status=PaymentStatus.PENDING,
    )
    db.add(payment)
    consultation.status = ConsultationStatus.PAYMENT_PENDING
    db.commit()
    db.refresh(payment)

    return PaymentResponse(
        id=payment.id,
        consultation_id=payment.consultation_id,
        amount=payment.amount,
        status=payment.status.value,
        uploaded_at=payment.uploaded_at,
    )


from app.models.chat_message import ChatMessage
from app.schemas.chat import ChatMessageResponse


@router.get("/{consultation_id}/messages", response_model=list[ChatMessageResponse])
def get_chat_history(
    consultation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    consultation = db.query(Consultation).filter(Consultation.id == consultation_id).first()
    if consultation is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Consultation not found")

    is_patient = (
        current_user.role == UserRole.PATIENT
        and current_user.patient
        and consultation.patient_id == current_user.patient.id
    )
    is_doctor = (
        current_user.role == UserRole.DOCTOR
        and current_user.doctor
        and consultation.doctor_id == current_user.doctor.id
    )

    if not (is_patient or is_doctor):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    rows = (
        db.query(ChatMessage, User)
        .join(User, ChatMessage.sender_user_id == User.id)
        .filter(ChatMessage.consultation_id == consultation_id)
        .order_by(ChatMessage.sent_at.asc())
        .all()
    )

    return [
        ChatMessageResponse(sender_role=user.role.value, message=msg.message_text, sent_at=msg.sent_at)
        for msg, user in rows
    ]
