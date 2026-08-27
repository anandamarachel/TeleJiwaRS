from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.consultation import Consultation


def test_authentication_is_required(client: TestClient):
    response = client.get("/patients/consultations")

    assert response.status_code == 401


def test_role_authorization_blocks_patient_from_admin_queue(client, users, auth_as):
    auth_as(users.patient)

    response = client.get("/admin/payments/pending")

    assert response.status_code == 403


def test_patient_cannot_access_another_patients_consultation(
    client: TestClient,
    db_session: Session,
    users,
    auth_as,
):
    consultation = Consultation(patient_id=users.other_patient.patient.id)
    db_session.add(consultation)
    db_session.commit()

    auth_as(users.patient)
    response = client.get(f"/patients/consultations/{consultation.id}")

    assert response.status_code == 403


def test_inactive_user_cookie_is_rejected(client, db_session, users, auth_as):
    users.patient.is_active = False
    db_session.commit()
    auth_as(users.patient)

    response = client.get("/auth/me")

    assert response.status_code == 401


def test_public_doctor_profiles_only_include_active_doctors(client, db_session, users):
    users.other_doctor.is_active = False
    db_session.commit()

    response = client.get("/doctors/public")

    assert response.status_code == 200
    assert response.json() == [
        {
            "id": users.doctor.doctor.id,
            "full_name": "Dr. Satu",
            "specialization": None,
        }
    ]
