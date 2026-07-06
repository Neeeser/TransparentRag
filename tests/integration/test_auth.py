from __future__ import annotations

from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

pytestmark = pytest.mark.integration


def test_user_registration_cycle(user_context: dict[str, object]) -> None:
    profile = user_context["user"]
    creds = user_context["credentials"]
    assert profile["email"] == creds["email"]
    assert profile["is_active"] is True
    assert profile.get("id")


def test_token_endpoint_requires_password_grant(client: TestClient) -> None:
    email = f"grant-check+{uuid4().hex[:8]}@transparentrag.io"
    password = "GrantCheck!123"
    register_resp = client.post(
        "/api/auth/register",
        json={
            "email": email,
            "password": password,
            "full_name": "Grant Check",
        },
    )
    assert register_resp.status_code == 201, register_resp.text

    bad_resp = client.post(
        "/api/auth/token",
        data={
            "username": email,
            "password": password,
            "grant_type": "",
        },
    )
    assert bad_resp.status_code == 422

    ok_resp = client.post(
        "/api/auth/token",
        data={
            "username": email,
            "password": password,
            "grant_type": "password",
        },
    )
    assert ok_resp.status_code == 200, ok_resp.text
    payload = ok_resp.json()
    assert payload.get("access_token")
