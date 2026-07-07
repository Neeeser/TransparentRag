"""HTTP-contract tests for the four config enforcement sites.

Each test flips a config field through `AppSettingRepository` (the same
DB-backed override path the admin PATCH route writes through) and invalidates
`get_app_config`'s process cache, mirroring the idiom in
`tests/api/test_config_routes.py` and `tests/services/test_app_config_service.py`.
The autouse `_invalidate_cache` fixture below resets the cache around every
test in this module for the same reason: route tests hit the module-level
cache, not a fresh service per call.

Upload-limit note: `UploadFile.size` (Starlette) is `None` for some transports;
the size cap enforced in `upload_document` is best-effort and falls through
when `size` is unavailable -- the content-type check still applies regardless.
"""

from __future__ import annotations

from collections.abc import Iterator
from uuid import UUID

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session

from app.api.routes import documents as documents_routes
from app.db import models
from app.db.repositories import AppSettingRepository
from app.schemas.documents import IngestionResponse
from app.services.app_config import invalidate_app_config_cache


@pytest.fixture(autouse=True)
def _invalidate_cache() -> Iterator[None]:
    """Ensure `get_app_config`'s process-wide cache never leaks across tests."""
    invalidate_app_config_cache()
    yield
    invalidate_app_config_cache()


def _set_override(session: Session, key: str, value: object) -> None:
    AppSettingRepository(session).upsert(key, value, updated_by=None)
    session.commit()
    invalidate_app_config_cache()


def _create_collection(session: Session, user: models.User) -> models.Collection:
    collection = models.Collection(
        user_id=user.id,
        name="Collection",
        description="",
        extra_metadata={},
    )
    session.add(collection)
    session.commit()
    session.refresh(collection)
    return collection


class _StubIngestionService:
    """Stand-in for IngestionService so upload tests never hit real ingestion."""

    def __init__(self, _session: Session) -> None:
        pass

    def ingest_upload(
        self,
        *,
        user: models.User,
        collection: models.Collection,
        filename: str | None,
        content_type: str | None,
        stream: object,
    ) -> IngestionResponse:
        return IngestionResponse(
            document_id=UUID(int=1),
            status=models.DocumentStatus.READY,
            num_chunks=1,
            num_tokens=1,
        )


# --- Enforcement 1: registration flag -----------------------------------


def test_register_returns_403_when_registration_disabled(
    unauthed_client: TestClient, session: Session
) -> None:
    _set_override(session, "auth.allow_registration", False)

    response = unauthed_client.post(
        "/api/auth/register",
        json={"email": "new@example.com", "password": "password123", "full_name": "New"},
    )

    assert response.status_code == 403


def test_register_succeeds_when_registration_enabled(
    unauthed_client: TestClient, session: Session
) -> None:
    _set_override(session, "auth.allow_registration", True)

    response = unauthed_client.post(
        "/api/auth/register",
        json={"email": "new2@example.com", "password": "password123", "full_name": "New"},
    )

    assert response.status_code == 201
