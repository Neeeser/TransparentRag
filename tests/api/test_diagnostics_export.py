"""HTTP contract for GET /api/admin/diagnostics/export: gating and shape."""

from __future__ import annotations

from fastapi.testclient import TestClient
from sqlmodel import Session

from app.db import models
from app.observability import configure_logging, get_log_buffer, get_logger
from app.schemas.enums import UserRole

_ENDPOINT = "/api/admin/diagnostics/export"


def _promote(session: Session, user: models.User) -> None:
    user.role = UserRole.ADMIN.value
    session.add(user)
    session.commit()
    session.refresh(user)


def test_export_requires_a_token(unauthed_client: TestClient) -> None:
    assert unauthed_client.get(_ENDPOINT).status_code == 401


def test_export_rejects_non_admin(client: TestClient) -> None:
    assert client.get(_ENDPOINT).status_code == 403


def test_export_returns_metadata_and_recent_records(
    client: TestClient, session: Session, auth_user: models.User
) -> None:
    _promote(session, auth_user)
    configure_logging("INFO", debug=False)
    get_log_buffer().clear()
    get_logger("app.test").info("ingestion.completed", document_id="d-export-1")

    response = client.get(_ENDPOINT)

    assert response.status_code == 200
    body = response.json()
    assert set(body) == {"metadata", "records"}
    metadata = body["metadata"]
    assert metadata["record_count"] == len(body["records"])
    assert metadata["buffer_capacity"] >= 1
    assert "note" in metadata
    events = [r.get("event") for r in body["records"]]
    assert "ingestion.completed" in events


def test_export_never_serializes_a_redacted_secret(
    client: TestClient, session: Session, auth_user: models.User
) -> None:
    _promote(session, auth_user)
    configure_logging("INFO", debug=False)
    get_log_buffer().clear()
    get_logger("app.test").info("auth.login.failed", api_key="sk-super-secret")

    response = client.get(_ENDPOINT)

    assert response.status_code == 200
    assert "sk-super-secret" not in response.text
