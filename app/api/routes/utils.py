"""Shared helpers for API route modules."""

from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException, status
from sqlmodel import Session

from app.db import models
from app.db.repositories import CollectionRepository


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
