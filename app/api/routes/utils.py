"""Shared helpers for API route modules."""

from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException, status
from sqlmodel import Session

from app.db import models
from app.db.repositories import CollectionRepository
from app.schemas.collections import CollectionRead
from app.services.errors import (
    ExternalServiceError,
    NotFoundError,
    ServiceError,
)


def collection_to_schema(collection: models.Collection) -> CollectionRead:
    """Convert a collection row into its wire schema.

    Field-by-field on purpose: the db column `extra_metadata` maps to the
    schema field `metadata`, so `model_validate(from_attributes=...)` cannot
    build this shape.
    """
    return CollectionRead(
        id=collection.id,
        user_id=collection.user_id,
        name=collection.name,
        description=collection.description,
        ingestion_pipeline_id=collection.ingestion_pipeline_id,
        retrieval_pipeline_id=collection.retrieval_pipeline_id,
        created_at=collection.created_at,
        updated_at=collection.updated_at,
        metadata=collection.extra_metadata,
    )


def get_collection_or_404(
    collection_id: UUID,
    user_id: UUID,
    session: Session,
) -> models.Collection:
    """Return a collection or raise a 404 HTTPException."""
    repo = CollectionRepository(session)
    collection = repo.get(collection_id, user_id=user_id)
    if not collection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Collection not found",
        )
    return collection


def to_http_exception(exc: ServiceError) -> HTTPException:
    """Translate a domain error into its HTTP equivalent for a route to raise.

    The single mapping every route shares: `NotFoundError` -> 404,
    `ExternalServiceError` -> 502, and any other `ServiceError`
    (`InvalidInputError` and the base) -> 400. `detail` is passed through
    verbatim, so structured per-field error maps survive to the client.
    """
    if isinstance(exc, NotFoundError):
        code = status.HTTP_404_NOT_FOUND
    elif isinstance(exc, ExternalServiceError):
        code = status.HTTP_502_BAD_GATEWAY
    else:
        code = status.HTTP_400_BAD_REQUEST
    return HTTPException(status_code=code, detail=exc.detail)
