from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models.admin import Admin
from app.models.consultation import Consultation, ConsultationStatus
from app.models.user import User, UserRole


def test_admin_can_list_staff_and_edit_doctor_name(client, db_session, users, auth_as):
    auth_as(users.admin)

    listed = client.get("/staff")
    assert listed.status_code == 200
    doctor = next(item for item in listed.json() if item["id"] == users.doctor.id)
    assert doctor["doctor_id"] == users.doctor.doctor.id
    assert doctor["license_number"] == "SIP-001"

    updated = client.patch(f"/staff/{users.doctor.id}", json={"full_name": "Dr. Nama Baru"})
    assert updated.status_code == 200
    assert updated.json()["full_name"] == "Dr. Nama Baru"
    db_session.refresh(users.doctor.doctor)
    assert users.doctor.doctor.full_name == "Dr. Nama Baru"


def test_staff_management_is_admin_only(client, users, auth_as):
    auth_as(users.doctor)

    assert client.get("/staff").status_code == 403
    assert client.patch(f"/staff/{users.doctor.id}", json={"full_name": "No"}).status_code == 403
    assert client.delete(f"/staff/{users.other_doctor.id}").status_code == 403


def test_admin_cannot_deactivate_self(client, users, auth_as):
    auth_as(users.admin)

    response = client.delete(f"/staff/{users.admin.id}")

    assert response.status_code == 409
    assert "akun sendiri" in response.json()["detail"]


def test_admin_can_deactivate_and_restore_another_admin(client, db_session, users, auth_as):
    second_admin_user = User(
        email="second-admin@example.com",
        password_hash=hash_password("password123"),
        role=UserRole.ADMIN,
    )
    db_session.add(second_admin_user)
    db_session.flush()
    db_session.add(Admin(user_id=second_admin_user.id, full_name="Admin Dua"))
    db_session.commit()
    auth_as(users.admin)

    deactivated = client.delete(f"/staff/{second_admin_user.id}")
    assert deactivated.status_code == 200
    assert deactivated.json()["is_active"] is False

    restored = client.post(f"/staff/{second_admin_user.id}/restore")
    assert restored.status_code == 200
    assert restored.json()["is_active"] is True

    auth_as(second_admin_user)
    assert client.get("/admin/payments/pending").status_code == 200
    denied = client.get("/staff")
    assert denied.status_code == 403
    assert "Admin Utama" in denied.json()["detail"]


def test_doctor_with_active_consultation_cannot_be_deactivated(
    client: TestClient,
    db_session: Session,
    users,
    auth_as,
):
    consultation = Consultation(
        patient_id=users.patient.patient.id,
        doctor_id=users.doctor.doctor.id,
        status=ConsultationStatus.ACTIVE,
    )
    db_session.add(consultation)
    db_session.commit()
    auth_as(users.admin)

    blocked = client.delete(f"/staff/{users.doctor.id}")
    assert blocked.status_code == 409
    assert "konsultasi aktif" in blocked.json()["detail"]

    consultation.status = ConsultationStatus.COMPLETED
    db_session.commit()
    deactivated = client.delete(f"/staff/{users.doctor.id}")
    assert deactivated.status_code == 200
    assert deactivated.json()["is_active"] is False
