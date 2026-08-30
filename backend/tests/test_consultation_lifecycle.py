from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.consultation import Consultation, ConsultationStatus
from app.models.chat_message import ChatMessage
from app.models.payment import Payment, PaymentStatus


def submit_screening(client: TestClient, consultation_id: int):
    questions = client.get("/consultations/screening/questions").json()
    return client.post(
        f"/consultations/{consultation_id}/screening",
        json={
            "chief_complaint": "Sulit tidur dan merasa sedih",
            "answers": [
                {"question_id": question["id"], "score_value": index + 1}
                for index, question in enumerate(questions)
            ],
        },
    )


def prepare_pending_payment(client, users, auth_as, isolated_uploads):
    auth_as(users.patient)
    started = client.post("/consultations/start")
    consultation_id = started.json()["id"]
    assert submit_screening(client, consultation_id).status_code == 201
    uploaded = client.post(
        f"/consultations/{consultation_id}/payment",
        files={"file": ("proof.png", b"\x89PNG\r\n\x1a\nvalid test image bytes", "image/png")},
    )
    assert uploaded.status_code == 201
    return consultation_id, uploaded.json()["id"]


def test_screening_summary_routes_patient_to_payment(client, users, auth_as):
    auth_as(users.patient)
    consultation_id = client.post("/consultations/start").json()["id"]

    before = client.get("/patients/consultations").json()[0]
    assert before["status"] == "screening"
    assert before["screening_submitted"] is False

    response = submit_screening(client, consultation_id)
    assert response.status_code == 201

    after = client.get("/patients/consultations").json()[0]
    assert after["status"] == "screening"
    assert after["screening_submitted"] is True

    instructions = client.get(f"/consultations/{consultation_id}/payment-instructions")
    assert instructions.status_code == 200
    assert instructions.json()["amount"] == "150000.00"
    assert instructions.json()["bank_name"] == "BCA"
    assert instructions.json()["bank_account_number"] == "124232034"
    assert instructions.json()["bank_account_holder"] == "Rumah Sakit TeleJiwa"


def test_duplicate_active_consultation_is_blocked(client, users, auth_as):
    auth_as(users.patient)
    assert client.post("/consultations/start").status_code == 201

    duplicate = client.post("/consultations/start")

    assert duplicate.status_code == 409


def test_rejected_payment_can_be_uploaded_again(client, db_session, users, auth_as, isolated_uploads):
    consultation_id, payment_id = prepare_pending_payment(client, users, auth_as, isolated_uploads)

    auth_as(users.admin)
    rejected = client.post(
        f"/admin/payments/{payment_id}/reject",
        json={
            "reason": "proof_unreadable",
            "note": "Mohon unggah foto yang lebih jelas.",
        },
    )
    assert rejected.status_code == 200
    assert rejected.json()["rejection_reason"] == "Bukti pembayaran tidak terbaca"
    assert rejected.json()["rejection_note"] == "Mohon unggah foto yang lebih jelas."
    assert rejected.json()["whatsapp_link"].startswith("https://wa.me/628")

    auth_as(users.patient)
    summary = client.get("/patients/consultations").json()[0]
    assert summary["payment_rejection_reason"] == "Bukti pembayaran tidak terbaca"
    assert summary["payment_rejection_note"] == "Mohon unggah foto yang lebih jelas."

    retried = client.post(
        f"/consultations/{consultation_id}/payment",
        files={"file": ("retry.pdf", b"%PDF-1.7 valid test pdf bytes", "application/pdf")},
    )
    assert retried.status_code == 201

    payments = db_session.query(Payment).filter(Payment.consultation_id == consultation_id).all()
    assert [payment.status for payment in payments] == [PaymentStatus.REJECTED, PaymentStatus.PENDING]
    assert payments[0].rejection_reason_code == "proof_unreadable"


def test_payment_rejection_requires_a_valid_reason(client, users, auth_as, isolated_uploads):
    _, payment_id = prepare_pending_payment(client, users, auth_as, isolated_uploads)
    auth_as(users.admin)

    missing_reason = client.post(f"/admin/payments/{payment_id}/reject", json={})
    assert missing_reason.status_code == 422

    other_without_note = client.post(
        f"/admin/payments/{payment_id}/reject",
        json={"reason": "other"},
    )
    assert other_without_note.status_code == 422


def test_full_consultation_lifecycle_and_terminal_chat_access(
    client,
    db_session,
    users,
    auth_as,
    isolated_uploads,
):
    consultation_id, payment_id = prepare_pending_payment(client, users, auth_as, isolated_uploads)

    auth_as(users.admin)
    approval = client.post(f"/admin/payments/{payment_id}/approve")
    assert approval.status_code == 200
    assert approval.json()["status"] == "approved"
    assert approval.json()["whatsapp_link"].startswith("https://wa.me/628")

    auth_as(users.doctor)
    queue = client.get("/doctors/queue").json()
    assert [item["consultation_id"] for item in queue] == [consultation_id]
    assert client.post(f"/doctors/consultations/{consultation_id}/claim").status_code == 200

    auth_as(users.other_doctor)
    losing_claim = client.post(f"/doctors/consultations/{consultation_id}/claim")
    assert losing_claim.status_code == 409
    assert client.get(f"/doctors/consultations/{consultation_id}").status_code == 403

    auth_as(users.patient)
    assert client.get(f"/consultations/{consultation_id}/messages").status_code == 200

    auth_as(users.doctor)
    completed = client.post(
        f"/doctors/consultations/{consultation_id}/end",
        json={
            "note_text": "Kondisi dinilai stabil dan perlu pemantauan.",
            "prescription_items": [
                {
                    "drug_name": "Obat Contoh",
                    "dosage": "10 mg",
                    "frequency": "1 kali sehari",
                    "duration": "7 hari",
                    "notes": "Sesudah makan",
                }
            ],
            "follow_up": {
                "follow_up_date": "2026-09-01",
                "instructions": "Kontrol kembali",
            },
            "referral": None,
        },
    )
    assert completed.status_code == 200
    assert completed.json()["status"] == "completed"

    auth_as(users.patient)
    assert client.get(f"/consultations/{consultation_id}/messages").status_code == 409
    detail = client.get(f"/patients/consultations/{consultation_id}")
    assert detail.status_code == 200
    assert detail.json()["status"] == "completed"
    assert detail.json()["note_text"] == "Kondisi dinilai stabil dan perlu pemantauan."
    assert detail.json()["prescription_items"][0]["drug_name"] == "Obat Contoh"

    consultation = db_session.query(Consultation).filter(Consultation.id == consultation_id).one()
    assert consultation.status == ConsultationStatus.COMPLETED


def test_chat_history_uses_stable_message_id_order(client, db_session, users, auth_as):
    consultation = Consultation(
        patient_id=users.patient.patient.id,
        doctor_id=users.doctor.doctor.id,
        status=ConsultationStatus.ACTIVE,
    )
    db_session.add(consultation)
    db_session.flush()

    now = datetime.now(timezone.utc)
    first = ChatMessage(
        consultation_id=consultation.id,
        sender_user_id=users.patient.id,
        message_text="first",
        sent_at=now,
    )
    second = ChatMessage(
        consultation_id=consultation.id,
        sender_user_id=users.doctor.id,
        message_text="second",
        sent_at=now - timedelta(minutes=1),
    )
    db_session.add_all([first, second])
    db_session.commit()

    auth_as(users.patient)
    response = client.get(f"/consultations/{consultation.id}/messages")

    assert response.status_code == 200
    assert [message["id"] for message in response.json()] == [first.id, second.id]
    assert [message["message"] for message in response.json()] == ["first", "second"]
