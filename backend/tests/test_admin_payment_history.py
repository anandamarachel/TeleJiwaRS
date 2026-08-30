from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.consultation import Consultation
from app.models.payment import Payment, PaymentStatus


def create_payment_history(db_session: Session, users):
    users.patient.patient.nik = "3173010101010001"
    consultation = Consultation(patient_id=users.patient.patient.id)
    db_session.add(consultation)
    db_session.flush()
    now = datetime.now(timezone.utc)
    approved = Payment(
        consultation_id=consultation.id,
        amount=150000,
        proof_file_path="payment_proofs/approved.png",
        status=PaymentStatus.APPROVED,
        verified_at=now,
        verified_by_admin_id=users.admin.admin.id,
    )
    rejected = Payment(
        consultation_id=consultation.id,
        amount=150000,
        proof_file_path="payment_proofs/rejected.png",
        status=PaymentStatus.REJECTED,
        verified_at=now - timedelta(minutes=5),
        verified_by_admin_id=users.admin.admin.id,
        rejection_reason_code="proof_unreadable",
        rejection_note="Foto bukti terlalu buram.",
    )
    pending = Payment(
        consultation_id=consultation.id,
        amount=150000,
        proof_file_path="payment_proofs/pending.png",
        status=PaymentStatus.PENDING,
    )
    db_session.add_all([approved, rejected, pending])
    db_session.commit()
    return approved, rejected


def test_admin_can_view_paginated_payment_history(
    client: TestClient,
    db_session: Session,
    users,
    auth_as,
):
    approved, rejected = create_payment_history(db_session, users)
    auth_as(users.admin)

    response = client.get("/admin/payments/history?limit=1&offset=0")

    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 2
    assert body["limit"] == 1
    assert [item["payment_id"] for item in body["items"]] == [approved.id]
    assert body["items"][0]["patient_nik"] == "3173010101010001"
    assert body["items"][0]["verified_by"] == "Admin Satu"

    rejected_only = client.get("/admin/payments/history?status=rejected")
    assert rejected_only.status_code == 200
    assert [item["payment_id"] for item in rejected_only.json()["items"]] == [rejected.id]
    assert rejected_only.json()["items"][0]["rejection_reason"] == "Bukti pembayaran tidak terbaca"
    assert rejected_only.json()["items"][0]["rejection_note"] == "Foto bukti terlalu buram."

    assert client.get("/admin/payments/history?status=pending").status_code == 422


def test_patient_cannot_view_payment_history(client, users, auth_as):
    auth_as(users.patient)

    response = client.get("/admin/payments/history")

    assert response.status_code == 403
