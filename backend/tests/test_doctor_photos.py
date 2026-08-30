from pathlib import Path
from urllib.parse import urlsplit

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session


def test_admin_can_upload_replace_and_delete_doctor_photo(
    client: TestClient,
    db_session: Session,
    users,
    auth_as,
    tmp_path: Path,
    monkeypatch,
):
    monkeypatch.setattr("app.api.doctor.settings.upload_dir", str(tmp_path))
    doctor_id = users.doctor.doctor.id
    auth_as(users.admin)

    uploaded = client.post(
        f"/doctors/manage/{doctor_id}/photo",
        files={"file": ("doctor.jpg", b"\xff\xd8\xffvalid doctor image", "image/jpeg")},
    )

    assert uploaded.status_code == 200
    assert uploaded.json()["photo_url"] is not None
    db_session.refresh(users.doctor.doctor)
    first_path = tmp_path / users.doctor.doctor.photo_file_path
    assert first_path.read_bytes() == b"\xff\xd8\xffvalid doctor image"

    public_profiles = client.get("/doctors/public").json()
    photo_url = next(profile["photo_url"] for profile in public_profiles if profile["id"] == doctor_id)
    photo_response = client.get(urlsplit(photo_url).path)
    assert photo_response.status_code == 200
    assert photo_response.content == b"\xff\xd8\xffvalid doctor image"

    replaced = client.post(
        f"/doctors/manage/{doctor_id}/photo",
        files={"file": ("doctor.png", b"\x89PNG\r\n\x1a\nreplacement", "image/png")},
    )
    assert replaced.status_code == 200
    assert not first_path.exists()

    deleted = client.delete(f"/doctors/manage/{doctor_id}/photo")
    assert deleted.status_code == 204
    db_session.refresh(users.doctor.doctor)
    assert users.doctor.doctor.photo_file_path is None
    assert client.get(urlsplit(photo_url).path).status_code == 404


def test_doctor_photo_management_is_admin_only(client, users, auth_as, tmp_path, monkeypatch):
    monkeypatch.setattr("app.api.doctor.settings.upload_dir", str(tmp_path))
    auth_as(users.doctor)

    assert client.get("/doctors/manage").status_code == 403
    response = client.post(
        f"/doctors/manage/{users.doctor.doctor.id}/photo",
        files={"file": ("doctor.jpg", b"\xff\xd8\xffimage", "image/jpeg")},
    )
    assert response.status_code == 403


def test_doctor_photo_rejects_spoofed_or_oversized_files(
    client,
    users,
    auth_as,
    tmp_path,
    monkeypatch,
):
    monkeypatch.setattr("app.api.doctor.settings.upload_dir", str(tmp_path))
    auth_as(users.admin)
    endpoint = f"/doctors/manage/{users.doctor.doctor.id}/photo"

    spoofed = client.post(
        endpoint,
        files={"file": ("doctor.jpg", b"not really an image", "image/jpeg")},
    )
    assert spoofed.status_code == 400

    oversized = client.post(
        endpoint,
        files={"file": ("doctor.jpg", b"\xff\xd8\xff" + b"x" * (2 * 1024 * 1024), "image/jpeg")},
    )
    assert oversized.status_code == 400
