from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.consultation import Consultation, ConsultationStatus
from app.models.patient import Patient
from app.models.patient_profile_change import PatientProfileChange
from app.models.user import User


def test_patient_can_view_and_update_profile(client: TestClient, db_session: Session, users, auth_as):
    auth_as(users.patient)

    response = client.get("/patients/me")
    assert response.status_code == 200
    assert response.json()["full_name"] == "Pasien Satu"

    response = client.patch(
        "/patients/me",
        json={
            "email": "NEW.PATIENT@example.com",
            "email_confirmation": "new.patient@example.com",
            "full_name": "  Pasien Diperbarui  ",
            "phone_number": "0813-3333-3333",
            "nik": "3173010101010001",
            "nik_confirmation": "3173010101010001",
            "current_password": "password123",
        },
    )

    assert response.status_code == 200
    assert response.json()["email"] == "new.patient@example.com"
    assert response.json()["full_name"] == "Pasien Diperbarui"
    assert response.json()["phone_number"] == "6281333333333"
    assert response.json()["nik"] == "3173010101010001"

    db_session.expire_all()
    patient = db_session.query(Patient).filter(Patient.id == users.patient.patient.id).one()
    assert patient.full_name == "Pasien Diperbarui"
    assert patient.nik == "3173010101010001"
    audits = db_session.query(PatientProfileChange).filter_by(patient_id=patient.id).all()
    assert {audit.field_name for audit in audits} == {"email", "nik"}
    assert all("3173010101010001" not in audit.new_value_masked for audit in audits)


def test_patient_profile_update_rejects_duplicate_identifiers(client, users, auth_as):
    auth_as(users.patient)

    response = client.patch(
        "/patients/me",
        json={
            "email": users.other_patient.email,
            "email_confirmation": users.other_patient.email,
            "full_name": "Pasien Satu",
            "phone_number": users.patient.patient.phone_number,
            "nik": "3173010101010002",
            "nik_confirmation": "3173010101010002",
            "current_password": "password123",
        },
    )

    assert response.status_code == 409


def test_patient_profile_update_rejects_duplicate_or_invalid_nik(
    client,
    db_session,
    users,
    auth_as,
):
    users.other_patient.patient.nik = "3173010101010099"
    db_session.commit()
    auth_as(users.patient)
    payload = {
        "email": users.patient.email,
        "email_confirmation": users.patient.email,
        "full_name": users.patient.patient.full_name,
        "phone_number": users.patient.patient.phone_number,
        "nik": "3173010101010099",
        "nik_confirmation": "3173010101010099",
        "current_password": "password123",
    }

    duplicate = client.patch("/patients/me", json=payload)
    assert duplicate.status_code == 409

    payload["nik"] = "12345"
    payload["nik_confirmation"] = "12345"
    invalid = client.patch("/patients/me", json=payload)
    assert invalid.status_code == 422


def test_sensitive_profile_changes_require_current_password(client, users, auth_as):
    auth_as(users.patient)
    payload = {
        "email": "changed@example.com",
        "email_confirmation": "changed@example.com",
        "full_name": users.patient.patient.full_name,
        "phone_number": users.patient.patient.phone_number,
        "nik": "3173010101010003",
        "nik_confirmation": "3173010101010003",
        "current_password": "wrong-password",
    }

    response = client.patch("/patients/me", json=payload)

    assert response.status_code == 400
    assert "Kata sandi" in response.json()["detail"]


def test_existing_nik_is_locked_after_consultation_history(
    client,
    db_session,
    users,
    auth_as,
):
    users.patient.patient.nik = "3173010101010004"
    db_session.add(Consultation(patient_id=users.patient.patient.id, status=ConsultationStatus.COMPLETED))
    db_session.commit()
    auth_as(users.patient)

    response = client.patch(
        "/patients/me",
        json={
            "email": users.patient.email,
            "email_confirmation": users.patient.email,
            "full_name": users.patient.patient.full_name,
            "phone_number": users.patient.patient.phone_number,
            "nik": "3173010101010005",
            "nik_confirmation": "3173010101010005",
            "current_password": "password123",
        },
    )

    assert response.status_code == 409
    assert "riwayat konsultasi" in response.json()["detail"]


def test_account_deletion_requires_correct_password(client, users, auth_as):
    auth_as(users.patient)

    response = client.request("DELETE", "/patients/me", json={"password": "wrong-password"})

    assert response.status_code == 400
    assert response.json()["detail"] == "Kata sandi tidak sesuai"


def test_account_deletion_is_blocked_during_open_consultation(
    client: TestClient,
    db_session: Session,
    users,
    auth_as,
):
    consultation = Consultation(patient_id=users.patient.patient.id)
    db_session.add(consultation)
    db_session.commit()
    auth_as(users.patient)

    response = client.request("DELETE", "/patients/me", json={"password": "password123"})

    assert response.status_code == 409
    assert "konsultasi yang berjalan" in response.json()["detail"]


def test_account_deletion_anonymizes_profile_and_invalidates_session(
    client: TestClient,
    db_session: Session,
    users,
    auth_as,
):
    completed = Consultation(
        patient_id=users.patient.patient.id,
        status=ConsultationStatus.COMPLETED,
    )
    db_session.add(completed)
    db_session.commit()
    user_id = users.patient.id
    patient_id = users.patient.patient.id
    auth_as(users.patient)

    response = client.request("DELETE", "/patients/me", json={"password": "password123"})

    assert response.status_code == 204
    assert client.get("/auth/me").status_code == 401

    db_session.expire_all()
    user = db_session.query(User).filter(User.id == user_id).one()
    patient = db_session.query(Patient).filter(Patient.id == patient_id).one()
    assert user.is_active is False
    assert user.email.endswith("@deleted.invalid")
    assert patient.full_name == "Akun Pasien Dihapus"
    assert patient.phone_number.startswith("deleted")
    assert patient.nik is None
    assert db_session.query(Consultation).filter(Consultation.id == completed.id).one()


def test_doctor_cannot_access_patient_profile_endpoint(client, users, auth_as):
    auth_as(users.doctor)

    assert client.get("/patients/me").status_code == 403
