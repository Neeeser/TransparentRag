"""HTTP-contract tests for the collection diagnostics endpoint."""

from __future__ import annotations

from uuid import uuid4

from fastapi.testclient import TestClient
from sqlmodel import Session

from app.db import models
from app.db.repositories import UserRepository
from tests.utils.providers import install_default_pipelines


def _collection_for(session: Session, user: models.User) -> models.Collection:
    collection = models.Collection(
        user_id=user.id, name="Docs", description="", extra_metadata={}
    )
    session.add(collection)
    session.commit()
    session.refresh(collection)
    return collection


def test_diagnostics_requires_auth(unauthed_client: TestClient):
    """No token -> 401 before any collection lookup."""
    response = unauthed_client.get(f"/api/collections/{uuid4()}/diagnostics")
    assert response.status_code == 401


def test_diagnostics_cross_user_is_404(client: TestClient, session: Session):
    """A collection owned by another user is not visible (404)."""
    other = models.User(email="other@example.com", full_name="Other", hashed_password="x")
    UserRepository(session).add(other)
    session.commit()
    session.refresh(other)
    install_default_pipelines(session, other)
    collection = _collection_for(session, other)
    response = client.get(f"/api/collections/{collection.id}/diagnostics")
    assert response.status_code == 404


def test_diagnostics_response_shape(client: TestClient, session: Session, auth_user: models.User):
    """A valid request returns the aggregate diagnostics response shape."""
    collection = _collection_for(session, auth_user)
    response = client.get(f"/api/collections/{collection.id}/diagnostics")
    assert response.status_code == 200
    body = response.json()
    assert body["collection_id"] == str(collection.id)
    assert set(body) >= {
        "error_count",
        "warning_count",
        "consistent",
        "diagnostics",
        "generated_at",
    }
    assert isinstance(body["diagnostics"], list)
