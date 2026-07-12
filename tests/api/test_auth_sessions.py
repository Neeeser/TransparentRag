"""Persistent authentication-session contract tests."""

from __future__ import annotations

from datetime import UTC, datetime

from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.core.security import hash_password
from app.db import models


def _login(client: TestClient, email: str, *, remember: bool = True):
    return client.post(
        "/api/auth/token",
        data={
            "grant_type": "password",
            "username": email,
            "password": "password123",
            "remember_me": str(remember).lower(),
        },
    )


def test_remembered_login_sets_rotating_refresh_cookie(
    unauthed_client: TestClient, session: Session
) -> None:
    user = models.User(
        email="remember@example.com",
        hashed_password=hash_password("password123"),
        remember_session_days=90,
    )
    session.add(user)
    session.commit()

    login = _login(unauthed_client, user.email)

    assert login.status_code == 200
    cookie = login.headers["set-cookie"]
    assert "ragworks_refresh=" in cookie
    assert "HttpOnly" in cookie
    assert "SameSite=lax" in cookie
    assert "Max-Age=7776000" in cookie
    first_cookie = unauthed_client.cookies["ragworks_refresh"]

    refreshed = unauthed_client.post("/api/auth/refresh")

    assert refreshed.status_code == 200
    assert refreshed.json()["access_token"]
    assert unauthed_client.cookies["ragworks_refresh"] != first_cookie


def test_non_remembered_login_uses_browser_session_cookie(
    unauthed_client: TestClient, session: Session
) -> None:
    user = models.User(
        email="session@example.com", hashed_password=hash_password("password123")
    )
    session.add(user)
    session.commit()

    response = _login(unauthed_client, user.email, remember=False)

    assert response.status_code == 200
    assert "Max-Age" not in response.headers["set-cookie"]


def test_logout_revokes_refresh_session(
    unauthed_client: TestClient, session: Session
) -> None:
    user = models.User(
        email="logout@example.com", hashed_password=hash_password("password123")
    )
    session.add(user)
    session.commit()
    _login(unauthed_client, user.email)

    response = unauthed_client.post("/api/auth/logout")

    assert response.status_code == 204
    assert unauthed_client.post("/api/auth/refresh").status_code == 401
    rows = session.exec(select(models.AuthSession)).all()
    assert len(rows) == 1
    assert rows[0].revoked_at is not None


def test_user_can_list_and_revoke_sessions(
    unauthed_client: TestClient, session: Session
) -> None:
    user = models.User(
        email="devices@example.com", hashed_password=hash_password("password123")
    )
    session.add(user)
    session.commit()
    login = _login(unauthed_client, user.email)
    token = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    listed = unauthed_client.get("/api/auth/sessions", headers=headers)

    assert listed.status_code == 200
    assert len(listed.json()) == 1
    assert listed.json()[0]["current"] is True
    session_id = listed.json()[0]["id"]

    revoked = unauthed_client.delete(f"/api/auth/sessions/{session_id}", headers=headers)

    assert revoked.status_code == 204
    assert unauthed_client.post("/api/auth/refresh").status_code == 401


def test_expired_refresh_session_is_rejected(
    unauthed_client: TestClient, session: Session
) -> None:
    user = models.User(
        email="expired@example.com", hashed_password=hash_password("password123")
    )
    session.add(user)
    session.commit()
    _login(unauthed_client, user.email)
    row = session.exec(select(models.AuthSession)).one()
    row.expires_at = datetime(2000, 1, 1, tzinfo=UTC)
    session.add(row)
    session.commit()

    assert unauthed_client.post("/api/auth/refresh").status_code == 401


def test_user_can_revoke_all_sessions(
    unauthed_client: TestClient, session: Session
) -> None:
    user = models.User(
        email="everywhere@example.com", hashed_password=hash_password("password123")
    )
    session.add(user)
    session.commit()
    login = _login(unauthed_client, user.email)
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}

    response = unauthed_client.delete("/api/auth/sessions", headers=headers)

    assert response.status_code == 204
    assert unauthed_client.post("/api/auth/refresh").status_code == 401
    assert all(row.revoked_at for row in session.exec(select(models.AuthSession)).all())
