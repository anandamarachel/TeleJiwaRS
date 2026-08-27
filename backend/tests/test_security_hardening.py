import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError
from starlette.websockets import WebSocketDisconnect

from app.core.config import Settings
from app.models.consultation import Consultation, ConsultationStatus
from app.models.chat_message import ChatMessage
from app.models.payment import Payment
from tests.test_consultation_lifecycle import submit_screening


def test_security_headers_are_present(client: TestClient):
    response = client.get("/consultations/screening/questions")

    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["x-frame-options"] == "DENY"
    assert response.headers["cache-control"] == "no-store"
    assert "camera=()" in response.headers["permissions-policy"]


def test_cross_origin_state_change_is_rejected(client, users, auth_as):
    auth_as(users.patient)

    response = client.post(
        "/consultations/start",
        headers={"Origin": "https://malicious.example"},
    )

    assert response.status_code == 403
    assert response.json()["detail"] == "Origin not allowed"


def test_login_is_rate_limited(client: TestClient):
    for index in range(5):
        response = client.post(
            "/auth/login",
            json={"email": f"missing-{index}@example.com", "password": "wrong-password"},
        )
        assert response.status_code == 401

    limited = client.post(
        "/auth/login",
        json={"email": "another@example.com", "password": "wrong-password"},
    )

    assert limited.status_code == 429
    assert limited.headers["retry-after"] == "60"


def test_spoofed_payment_proof_is_rejected(client, users, auth_as, isolated_uploads):
    auth_as(users.patient)
    consultation_id = client.post("/consultations/start").json()["id"]
    assert submit_screening(client, consultation_id).status_code == 201

    response = client.post(
        f"/consultations/{consultation_id}/payment",
        files={"file": ("proof.png", b"<html>not an image</html>", "image/png")},
    )

    assert response.status_code == 400
    assert list(isolated_uploads.rglob("*")) == []


def test_upload_uses_detected_canonical_extension(
    client,
    db_session,
    users,
    auth_as,
    isolated_uploads,
):
    auth_as(users.patient)
    consultation_id = client.post("/consultations/start").json()["id"]
    assert submit_screening(client, consultation_id).status_code == 201

    response = client.post(
        f"/consultations/{consultation_id}/payment",
        files={"file": ("dangerous.html", b"\x89PNG\r\n\x1a\nimage data", "image/png")},
    )

    assert response.status_code == 201
    payment = db_session.query(Payment).filter(Payment.consultation_id == consultation_id).one()
    assert payment.proof_file_path.endswith(".png")
    assert not payment.proof_file_path.endswith(".html")


def test_unsafe_production_configuration_fails_fast():
    with pytest.raises(ValidationError):
        Settings(
            _env_file=None,
            environment="production",
            database_url="postgresql://example",
            secret_key="short",
            cookie_secure=False,
            cors_origins="http://localhost:3000",
            allowed_hosts="*",
            smtp_host="smtp.example.com",
            smtp_username="user",
            smtp_password="password",
            admin_notification_email="admin@example.com",
            smtp_from_email="sender@example.com",
        )


def test_deactivated_user_cannot_open_websocket(
    client,
    db_session,
    users,
    auth_as,
    monkeypatch,
):
    consultation = Consultation(
        patient_id=users.patient.patient.id,
        doctor_id=users.doctor.doctor.id,
        status=ConsultationStatus.ACTIVE,
    )
    users.patient.is_active = False
    db_session.add(consultation)
    db_session.commit()
    auth_as(users.patient)
    monkeypatch.setattr("app.api.chat.SessionLocal", lambda: db_session)

    with pytest.raises(WebSocketDisconnect) as disconnect:
        with client.websocket_connect(
            f"/ws/consultations/{consultation.id}",
            headers={"Origin": "http://localhost:3000"},
        ):
            pass

    assert disconnect.value.code == 1008


def test_oversized_websocket_message_is_closed(
    client,
    db_session,
    users,
    auth_as,
    monkeypatch,
):
    consultation = Consultation(
        patient_id=users.patient.patient.id,
        doctor_id=users.doctor.doctor.id,
        status=ConsultationStatus.ACTIVE,
    )
    db_session.add(consultation)
    db_session.commit()
    consultation_id = consultation.id
    auth_as(users.patient)
    monkeypatch.setattr("app.api.chat.SessionLocal", lambda: db_session)

    with client.websocket_connect(
        f"/ws/consultations/{consultation_id}",
        headers={"Origin": "http://localhost:3000"},
    ) as websocket:
        websocket.send_json({"message": "x" * 4001})
        with pytest.raises(WebSocketDisconnect) as disconnect:
            websocket.receive_json()

    assert disconnect.value.code == 1009


def test_websocket_marks_incoming_message_as_read(
    client,
    db_session,
    users,
    auth_as,
    monkeypatch,
):
    consultation = Consultation(
        patient_id=users.patient.patient.id,
        doctor_id=users.doctor.doctor.id,
        status=ConsultationStatus.ACTIVE,
    )
    db_session.add(consultation)
    db_session.flush()
    message = ChatMessage(
        consultation_id=consultation.id,
        sender_user_id=users.doctor.id,
        message_text="Bagaimana kondisi Anda?",
    )
    db_session.add(message)
    db_session.commit()
    consultation_id = consultation.id
    message_id = message.id
    auth_as(users.patient)
    monkeypatch.setattr("app.api.chat.SessionLocal", lambda: db_session)

    with client.websocket_connect(
        f"/ws/consultations/{consultation_id}",
        headers={"Origin": "http://localhost:3000"},
    ) as websocket:
        websocket.send_json({"type": "read", "message_ids": [message_id]})
        receipt = websocket.receive_json()

    assert receipt["type"] == "read"
    assert receipt["message_ids"] == [message_id]
    assert db_session.get(ChatMessage, message_id).read_at is not None
