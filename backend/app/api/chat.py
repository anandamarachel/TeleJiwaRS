from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.user import User, UserRole
from app.models.consultation import Consultation, ConsultationStatus
from app.models.chat_message import ChatMessage
from app.core.security import decode_access_token
from app.core.chat_manager import manager
import jwt

router = APIRouter(tags=["chat"])


@router.websocket("/ws/consultations/{consultation_id}")
async def chat_endpoint(websocket: WebSocket, consultation_id: int,):
    db: Session = SessionLocal()

    token = websocket.cookies.get("access_token")
    if token is None:
        await websocket.close(code=1008)
        db.close()
        return

    try:
        payload = decode_access_token(token)
        user_id = int(payload["sub"])
    except (jwt.InvalidTokenError, jwt.ExpiredSignatureError, KeyError):
        await websocket.close(code=1008)
        db.close()
        return

    user = db.query(User).filter(User.id == user_id).first()
    consultation = db.query(Consultation).filter(Consultation.id == consultation_id).first()

    if user is None or consultation is None:
        await websocket.close(code=1008)
        db.close()
        return

    is_patient = user.role == UserRole.PATIENT and user.patient and consultation.patient_id == user.patient.id
    is_doctor = user.role == UserRole.DOCTOR and user.doctor and consultation.doctor_id == user.doctor.id

    if not (is_patient or is_doctor):
        await websocket.close(code=1008)
        db.close()
        return

    if consultation.status != ConsultationStatus.ACTIVE:
        await websocket.close(code=1008)
        db.close()
        return

    await manager.connect(consultation_id, websocket)

    try:
        while True:
            data = await websocket.receive_json()
            text = data.get("message", "").strip()
            if not text:
                continue

            chat_message = ChatMessage(
                consultation_id=consultation_id,
                sender_user_id=user.id,
                message_text=text,
            )
            db.add(chat_message)
            db.commit()
            db.refresh(chat_message)

            await manager.broadcast(consultation_id, {
                "sender_role": user.role.value,
                "message": text,
                "sent_at": chat_message.sent_at.isoformat(),
            })
    except WebSocketDisconnect:
        manager.disconnect(consultation_id, websocket)
    finally:
        db.close()