from __future__ import annotations

from typing import Any, ClassVar

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
        deletion_protection="enabled",
        tags={"env": "test"},
    )
    response = indexes_routes.create_index(payload, current_user=_create_user_with_key())

    assert response.name == "alpha"
    assert created["name"] == "alpha"
    assert created["dimension"] == 768
    assert created["deletion_protection"] == "enabled"
    assert created["tags"] == {"env": "test"}


def test_as_dict_handles_model_dump_and_attributes() -> None:
    class _StubModelDump:
        def model_dump(self, mode: str | None = None) -> dict[str, Any]:
            assert mode == "json"
            return {"name": "alpha", "metric": "cosine"}

    class _StubAttrs:
        name = "beta"
        metric = "dotproduct"
        dimension = 42
        status: ClassVar[dict[str, str]] = {"state": "Ready"}

    assert indexes_routes._as_dict(_StubModelDump()) == {"name": "alpha", "metric": "cosine"}
    assert indexes_routes._as_dict(_StubAttrs())["name"] == "beta"
    assert indexes_routes._as_dict("gamma") == {"name": "gamma"}
    assert indexes_routes._as_dict(object())["name"]


def test_safe_value_handles_nested_objects() -> None:
    class _StubToDict:
        def to_dict(self) -> dict[str, Any]:
            return {"inner": "value"}

    class _StubModelDump:
        def model_dump(self, mode: str | None = None) -> dict[str, Any]:
            return {"dumped": True}

    class _Bare:
        def __repr__(self) -> str:
            return "bare"

    payload = {
        "list": [1, _StubToDict(), {"nested": _StubModelDump()}, _Bare()],
    }
    encoded = indexes_routes._safe_value(payload)

    assert indexes_routes._safe_value("alpha") == "alpha"
    assert encoded["list"][1] == {"inner": "value"}
    assert encoded["list"][2]["nested"] == {"dumped": True}
    assert encoded["list"][3] == "bare"


def test_iter_indexes_handles_multiple_shapes() -> None:
    class _StubIndexes:
        def __init__(self, indexes: list[Any]) -> None:
            self.indexes = indexes

    assert list(indexes_routes._iter_indexes(None)) == []
    assert list(indexes_routes._iter_indexes({"indexes": ["alpha"]})) == ["alpha"]
    assert list(indexes_routes._iter_indexes(_StubIndexes(["beta"]))) == ["beta"]
    assert list(indexes_routes._iter_indexes(["gamma"])) == ["gamma"]
    assert list(indexes_routes._iter_indexes({"indexes": "nope"})) == []
    assert list(indexes_routes._iter_indexes(_StubIndexes("nope"))) == []
    assert list(indexes_routes._iter_indexes(123)) == []


def test_create_index_allows_sparse_without_dimension(monkeypatch) -> None:
    created: dict[str, Any] = {}

    class _StubPinecone:
        def create_index(self, **kwargs: Any) -> None:
            created.update(kwargs)

        def describe_index(self, name: str) -> dict[str, Any]:
            return {"name": name, "metric": "dotproduct", "vector_type": "sparse"}

    monkeypatch.setattr(indexes_routes, "get_pinecone_client", lambda **_: _StubPinecone())

    payload = indexes_routes.PineconeIndexCreateRequest(
        name="sparse-index",
        vector_type="sparse",
        metric="dotproduct",
    )
    response = indexes_routes.create_index(payload, current_user=_create_user_with_key())

    assert response.name == "sparse-index"
    assert "dimension" not in created


def test_delete_index_calls_client(monkeypatch) -> None:
    deleted: dict[str, Any] = {}

    class _StubPinecone:
        def delete_index(self, name: str) -> None:
            deleted["name"] = name

    monkeypatch.setattr(indexes_routes, "get_pinecone_client", lambda **_: _StubPinecone())

    response = indexes_routes.delete_index("alpha", current_user=_create_user_with_key())

    assert response.status == "deleted"
    assert deleted["name"] == "alpha"
