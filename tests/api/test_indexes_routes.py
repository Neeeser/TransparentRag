from __future__ import annotations

from typing import Any

import pytest
from fastapi import HTTPException

from app.api.routes import indexes as indexes_routes
from app.db import models


def _create_user_with_key() -> models.User:
    return models.User(
        email="pinecone@example.com",
        full_name="Pinecone User",
        hashed_password="hashed",
        pinecone_api_key="pinecone-key",
    )


def test_list_indexes_requires_key() -> None:
    user = models.User(email="no-key@example.com", full_name="No Key", hashed_password="hashed")

    with pytest.raises(HTTPException) as excinfo:
        indexes_routes.list_indexes(current_user=user)

    assert excinfo.value.status_code == 400


def test_list_indexes_returns_serialized(monkeypatch) -> None:
    class _StubPinecone:
        def list_indexes(self):
            return {
                "indexes": [
                    {
                        "name": "alpha",
                        "metric": "cosine",
                        "dimension": 1536,
                        "vector_type": "dense",
                        "status": {"ready": True, "state": "Ready"},
                        "spec": {"serverless": {"cloud": "aws", "region": "us-east-1"}},
                    }
                ]
            }

    monkeypatch.setattr(indexes_routes, "get_pinecone_client", lambda **_: _StubPinecone())

    response = indexes_routes.list_indexes(current_user=_create_user_with_key())

    assert response.indexes
    assert response.indexes[0].name == "alpha"


def test_describe_index_returns_entry(monkeypatch) -> None:
    class _StubPinecone:
        def describe_index(self, name: str) -> dict[str, Any]:
            return {"name": name, "metric": "cosine", "vector_type": "dense"}

    monkeypatch.setattr(indexes_routes, "get_pinecone_client", lambda **_: _StubPinecone())

    response = indexes_routes.describe_index("alpha", current_user=_create_user_with_key())

    assert response.name == "alpha"


def test_create_index_uses_defaults(monkeypatch) -> None:
    created: dict[str, Any] = {}

    class _StubPinecone:
        def create_index(
            self,
            *,
            name: str,
            metric: str,
            spec: Any,
            vector_type: str,
            dimension: int | None = None,
            deletion_protection: str | None = None,
            tags: dict[str, str] | None = None,
        ) -> None:
            created.update(
                {
                    "name": name,
                    "metric": metric,
                    "spec": spec,
                    "vector_type": vector_type,
                    "dimension": dimension,
                    "deletion_protection": deletion_protection,
                    "tags": tags,
                }
            )

        def describe_index(self, name: str) -> dict[str, Any]:
            return {"name": name, "metric": "cosine", "vector_type": "dense"}

    monkeypatch.setattr(indexes_routes, "get_pinecone_client", lambda **_: _StubPinecone())

    payload = indexes_routes.PineconeIndexCreateRequest(
        name="alpha",
        dimension=768,
        metric="cosine",
        vector_type="dense",
    )
    response = indexes_routes.create_index(payload, current_user=_create_user_with_key())

    assert response.name == "alpha"
    assert created["name"] == "alpha"
    assert created["dimension"] == 768


def test_delete_index_calls_client(monkeypatch) -> None:
    deleted: dict[str, Any] = {}

    class _StubPinecone:
        def delete_index(self, name: str) -> None:
            deleted["name"] = name

    monkeypatch.setattr(indexes_routes, "get_pinecone_client", lambda **_: _StubPinecone())

    response = indexes_routes.delete_index("alpha", current_user=_create_user_with_key())

    assert response.status == "deleted"
    assert deleted["name"] == "alpha"
