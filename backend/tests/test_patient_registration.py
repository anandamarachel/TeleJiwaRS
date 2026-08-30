from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.patient import Patient


def registration_payload(**overrides):
    payload = {
        "email": "new.patient@example.com",
        "password": "password123",
        "full_name": "Pasien Baru",
        "phone_number": "081399999999",
        "nik": "3173010101010001",
    }
    payload.update(overrides)
    return payload


def test_registration_stores_valid_nik(client: TestClient, db_session: Session):
    response = client.post("/patients/register", json=registration_payload())

    assert response.status_code == 201
    assert response.json()["nik"] == "3173010101010001"
    patient = db_session.query(Patient).filter(Patient.nik == "3173010101010001").one()
    assert patient.full_name == "Pasien Baru"


def test_registration_rejects_invalid_nik(client: TestClient):
    response = client.post("/patients/register", json=registration_payload(nik="12345"))

    assert response.status_code == 422


def test_registration_rejects_duplicate_nik(client: TestClient):
    assert client.post("/patients/register", json=registration_payload()).status_code == 201

    duplicate = client.post(
        "/patients/register",
        json=registration_payload(
            email="another.patient@example.com",
            phone_number="081388888888",
        ),
    )

    assert duplicate.status_code == 409
    assert "NIK" in duplicate.json()["detail"]
