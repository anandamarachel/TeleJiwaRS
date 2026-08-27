from dataclasses import dataclass
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.security import create_access_token, hash_password
from app.core.rate_limit import rate_limiter
from app.api.chat import websocket_rate_limiter
from app.database import Base, get_db
from app.main import app
from app.models.admin import Admin
from app.models.doctor import Doctor
from app.models.patient import Patient
from app.models.screening import ScreeningQuestion
from app.models.user import User, UserRole


@dataclass
class TestUsers:
    patient: User
    other_patient: User
    doctor: User
    other_doctor: User
    admin: User


@pytest.fixture(autouse=True)
def reset_rate_limiters():
    rate_limiter.clear()
    websocket_rate_limiter.clear()
    yield
    rate_limiter.clear()
    websocket_rate_limiter.clear()


@pytest.fixture
def db_session():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    @event.listens_for(engine, "connect")
    def enable_foreign_keys(dbapi_connection, _):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    testing_session = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)

    def override_get_db():
        session = testing_session()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_db] = override_get_db
    session = testing_session()
    try:
        yield session
    finally:
        session.close()
        app.dependency_overrides.clear()
        Base.metadata.drop_all(bind=engine)
        engine.dispose()


@pytest.fixture
def client(db_session: Session):
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def users(db_session: Session) -> TestUsers:
    password_hash = hash_password("password123")

    patient_user = User(email="patient@example.com", password_hash=password_hash, role=UserRole.PATIENT)
    other_patient_user = User(email="other@example.com", password_hash=password_hash, role=UserRole.PATIENT)
    doctor_user = User(email="doctor@example.com", password_hash=password_hash, role=UserRole.DOCTOR)
    other_doctor_user = User(email="doctor2@example.com", password_hash=password_hash, role=UserRole.DOCTOR)
    admin_user = User(email="admin@example.com", password_hash=password_hash, role=UserRole.ADMIN)
    db_session.add_all([patient_user, other_patient_user, doctor_user, other_doctor_user, admin_user])
    db_session.flush()

    db_session.add_all([
        Patient(user_id=patient_user.id, full_name="Pasien Satu", phone_number="628111111111"),
        Patient(user_id=other_patient_user.id, full_name="Pasien Dua", phone_number="628222222222"),
        Doctor(user_id=doctor_user.id, full_name="Dr. Satu", license_number="SIP-001"),
        Doctor(user_id=other_doctor_user.id, full_name="Dr. Dua", license_number="SIP-002"),
        Admin(user_id=admin_user.id, full_name="Admin Satu"),
        ScreeningQuestion(text="Minat atau kesenangan berkurang?", order_index=1, is_active=True),
        ScreeningQuestion(text="Merasa sedih atau putus asa?", order_index=2, is_active=True),
    ])
    db_session.commit()

    for user in (patient_user, other_patient_user, doctor_user, other_doctor_user, admin_user):
        db_session.refresh(user)

    return TestUsers(patient_user, other_patient_user, doctor_user, other_doctor_user, admin_user)


@pytest.fixture
def auth_as(client: TestClient):
    def authenticate(user: User):
        client.cookies.clear()
        client.cookies.set("access_token", create_access_token(user.id, user.role.value))
        return client

    return authenticate


@pytest.fixture
def isolated_uploads(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr("app.api.consultations.settings.upload_dir", str(tmp_path))
    monkeypatch.setattr("app.api.consultations.send_admin_payment_notification", lambda **_: True)
    return tmp_path
