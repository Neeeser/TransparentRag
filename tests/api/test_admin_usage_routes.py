"""HTTP contract for /api/admin/usage/*: auth gating, shape, window validation."""

from __future__ import annotations

from uuid import uuid4

from fastapi.testclient import TestClient
from sqlmodel import Session

from app.db import models
from app.db.repositories import TelemetryRepository
from app.schemas.enums import UserRole


def _promote(session: Session, user: models.User) -> None:
    user.role = UserRole.ADMIN.value
    session.add(user)
    session.commit()
    session.refresh(user)


def test_usage_summary_requires_token(unauthed_client: TestClient) -> None:
    assert unauthed_client.get("/api/admin/usage/summary").status_code == 401


def test_usage_summary_rejects_non_admin(client: TestClient) -> None:
    assert client.get("/api/admin/usage/summary").status_code == 403


def test_usage_summary_returns_windowed_shape(
    client: TestClient, session: Session, auth_user: models.User
) -> None:
    _promote(session, auth_user)
    TelemetryRepository(session).add(
        event_type="chat.turn_completed",
        user_id=auth_user.id,
        payload={"session_id": str(uuid4()), "total_tokens": 42, "cost": 0.02},
    )
    session.commit()

    response = client.get("/api/admin/usage/summary", params={"days": 7})

    assert response.status_code == 200
    body = response.json()
    assert body["window_days"] == 7
    assert body["total_turns"] == 1
    assert body["total_tokens"] == 42
    assert body["active_users"] == 1
    assert body["users"][0]["email"] == auth_user.email
    assert "hashed_password" not in body["users"][0]


def test_usage_timeseries_returns_points(
    client: TestClient, session: Session, auth_user: models.User
) -> None:
    _promote(session, auth_user)
    TelemetryRepository(session).add(
        event_type="chat.turn_completed",
        user_id=auth_user.id,
        payload={"session_id": str(uuid4()), "total_tokens": 7},
    )
    session.commit()

    response = client.get("/api/admin/usage/timeseries")

    assert response.status_code == 200
    body = response.json()
    assert body["window_days"] == 30
    assert len(body["points"]) == 1
    assert body["points"][0]["total_tokens"] == 7


def test_usage_summary_rejects_out_of_range_window(
    client: TestClient, session: Session, auth_user: models.User
) -> None:
    _promote(session, auth_user)
    assert client.get("/api/admin/usage/summary", params={"days": 0}).status_code == 422
    assert client.get("/api/admin/usage/summary", params={"days": 400}).status_code == 422
