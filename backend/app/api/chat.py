from datetime import datetime, timezone

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.user import User, UserRole
from app.models.consultation import Consultation, ConsultationStatus
from app.models.chat_message import ChatMessage
from app.core.security import decode_access_token
from app.core.chat_manager import manager
from app.core.config import settings
from app.core.rate_limit import InMemoryRateLimiter
import jwt

router = APIRouter(tags=["chat"])
websocket_rate_limiter = InMemoryRateLimiter()


@router.websocket("/ws/consultations/{consultation_id}")
async def chat_endpoint(websocket: WebSocket, consultation_id: int,):
    db: Session = SessionLocal()

    origin = websocket.headers.get("origin")
    if origin and origin not in settings.cors_origin_list:
        await websocket.close(code=1008, reason="Origin not allowed")
        db.close()
        return

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

    if user is None or not user.is_active or consultation is None:
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
            event_type = data.get("type", "message")

            db.refresh(user, attribute_names=["is_active"])
            db.refresh(consultation, attribute_names=["status"])
            if not user.is_active or consultation.status != ConsultationStatus.ACTIVE:
                await websocket.close(code=1008, reason="Consultation is no longer active")
                break

            if event_type == "read":
                raw_ids = data.get("message_ids", [])
                if not isinstance(raw_ids, list):
                    continue
                message_ids = list({value for value in raw_ids if isinstance(value, int)})[:200]
                if not message_ids:
                    continue

                unread_ids = [
                    row.id
                    for row in db.query(ChatMessage.id)
                    .filter(
                        ChatMessage.id.in_(message_ids),
                        ChatMessage.consultation_id == consultation_id,
                        ChatMessage.sender_user_id != user.id,
                        ChatMessage.read_at.is_(None),
                    )
                    .all()
                ]
                if not unread_ids:
                    continue

                read_at = datetime.now(timezone.utc)
                (
                    db.query(ChatMessage)
                    .filter(ChatMessage.id.in_(unread_ids))
                    .update({"read_at": read_at}, synchronize_session=False)
                )
                db.commit()
                await manager.broadcast(consultation_id, {
                    "type": "read",
                    "message_ids": unread_ids,
                    "read_at": read_at.isoformat(),
                })
                continue

            text = data.get("message", "").strip()
            if not text:
                continue

            if len(text) > settings.max_chat_message_chars:
                await websocket.close(code=1009, reason="Message too large")
                break

            rate_key = f"websocket:{consultation_id}:{user.id}"
            if not websocket_rate_limiter.allow(
                rate_key,
                settings.websocket_messages_per_minute,
                60,
            ):
                await websocket.close(code=1008, reason="Message rate limit exceeded")
                break

            chat_message = ChatMessage(
                consultation_id=consultation_id,
                sender_user_id=user.id,
                message_text=text,
            )
            db.add(chat_message)
            db.commit()
            db.refresh(chat_message)

            await manager.broadcast(consultation_id, {
                "type": "message",
                "id": chat_message.id,
                "sender_role": user.role.value,
                "message": text,
                "sent_at": chat_message.sent_at.isoformat(),
                "read_at": None,
            })
    except WebSocketDisconnect:
        pass
    finally:
        manager.disconnect(consultation_id, websocket)
        db.close()
