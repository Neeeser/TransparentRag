"""Pinecone index management API routes."""

from __future__ import annotations

import inspect
from collections.abc import Iterable
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pinecone import ServerlessSpec  # pylint: disable=no-name-in-module

from app.api.config import get_settings
from app.api.dependencies import get_current_user
from app.db import models
from app.retrieval.pinecone import get_pinecone_client
from app.schemas.pinecone_indexes import (
    PineconeIndex,
    PineconeIndexCreateRequest,
    PineconeIndexDeleteResponse,
    PineconeIndexList,
)

router = APIRouter(prefix="/api/indexes", tags=["indexes"])

settings = get_settings()


def _require_pinecone_key(user: models.User) -> str:
    """Return the user's Pinecone API key or raise an HTTP error."""
    api_key = (user.pinecone_api_key or "").strip()
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Pinecone API key is not configured.",
        )
    return api_key


def _as_dict(value: Any) -> dict[str, Any]:
    """Convert SDK models into JSON-serializable dicts."""
    if isinstance(value, dict):
        return value
    if isinstance(value, str):
        return {"name": value}
    model_dump = getattr(value, "model_dump", None)
    if callable(model_dump):
        return model_dump(mode="json")  # type: ignore[no-any-return]
    fields = [
        "name",
        "vector_type",
        "metric",
        "dimension",
        "status",
        "host",
        "spec",
        "deletion_protection",
        "tags",
        "embed",
    ]
    if any(hasattr(value, field) for field in fields):
        return {
            field: _safe_value(getattr(value, field, None))
            for field in fields
            if hasattr(value, field)
        }
    return {"name": str(value)}


def _safe_value(value: Any) -> Any:
    """Return JSON-friendly values for nested objects."""
    if isinstance(value, (str, int, float, bool)) or value is None:
        return value
    if isinstance(value, dict):
        return {key: _safe_value(val) for key, val in value.items()}
    if isinstance(value, list):
        return [_safe_value(item) for item in value]
    model_dump = getattr(value, "model_dump", None)
    if callable(model_dump):
        return _safe_value(model_dump(mode="json"))
    to_dict = getattr(value, "to_dict", None)
    if callable(to_dict):
        return _safe_value(to_dict())
    return str(value)


def _iter_indexes(value: Any) -> Iterable[Any]:
    """Normalize list indexes responses into iterable entries."""
    if value is None:
        return []
    if isinstance(value, dict):
        indexes = value.get("indexes")
        if isinstance(indexes, list):
            return indexes
    if hasattr(value, "indexes"):
        indexes = value.indexes
        if isinstance(indexes, list):
            return indexes
    if isinstance(value, list):
        return value
    return []


@router.get("", response_model=PineconeIndexList)
def list_indexes(current_user: models.User = Depends(get_current_user)) -> PineconeIndexList:
    """List Pinecone indexes for the current user."""
    api_key = _require_pinecone_key(current_user)
    client = get_pinecone_client(api_key=api_key)
    result = client.list_indexes()
    indexes = [PineconeIndex.model_validate(_as_dict(index)) for index in _iter_indexes(result)]
    return PineconeIndexList(indexes=indexes)


@router.get("/{index_name}", response_model=PineconeIndex)
def describe_index(
    index_name: str,
    current_user: models.User = Depends(get_current_user),
) -> PineconeIndex:
    """Return details for a specific Pinecone index."""
    api_key = _require_pinecone_key(current_user)
    client = get_pinecone_client(api_key=api_key)
    try:
        index = client.describe_index(index_name)
    except Exception as exc:  # pragma: no cover - SDK errors vary by version
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
    return PineconeIndex.model_validate(_as_dict(index))


@router.post("", response_model=PineconeIndex, status_code=status.HTTP_201_CREATED)
def create_index(
    payload: PineconeIndexCreateRequest,
    current_user: models.User = Depends(get_current_user),
) -> PineconeIndex:
    """Create a serverless Pinecone index."""
    api_key = _require_pinecone_key(current_user)
    client = get_pinecone_client(api_key=api_key)
    cloud = (payload.cloud or settings.pinecone_cloud).strip()
    region = (payload.region or settings.pinecone_region).strip()
    spec = ServerlessSpec(cloud=cloud, region=region)

    create_kwargs: dict[str, Any] = {
        "name": payload.name,
        "metric": payload.metric,
        "spec": spec,
        "vector_type": payload.vector_type,
    }
    if payload.dimension is not None:
        create_kwargs["dimension"] = payload.dimension
    if payload.deletion_protection:
        create_kwargs["deletion_protection"] = payload.deletion_protection
    if payload.tags:
        create_kwargs["tags"] = payload.tags

    try:
        params = inspect.signature(client.create_index).parameters
        supports_kwargs = any(
            param.kind is inspect.Parameter.VAR_KEYWORD for param in params.values()
        )
    except (TypeError, ValueError):  # pragma: no cover - defensive for SDK variations
        params = {}
        supports_kwargs = True

    filtered_kwargs = (
        create_kwargs
        if supports_kwargs or not params
        else {key: value for key, value in create_kwargs.items() if key in params}
    )
    client.create_index(**filtered_kwargs)
    index = client.describe_index(payload.name)
    return PineconeIndex.model_validate(_as_dict(index))


@router.delete("/{index_name}", response_model=PineconeIndexDeleteResponse)
def delete_index(
    index_name: str,
    current_user: models.User = Depends(get_current_user),
) -> PineconeIndexDeleteResponse:
    """Delete a Pinecone index by name."""
    api_key = _require_pinecone_key(current_user)
    client = get_pinecone_client(api_key=api_key)
    client.delete_index(index_name)
    return PineconeIndexDeleteResponse()
