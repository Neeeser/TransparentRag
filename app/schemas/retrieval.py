"""Retrieval request and response schema models."""

from __future__ import annotations

from typing import Any, Dict, List
from uuid import UUID

from pydantic import BaseModel


class RetrievedChunk(BaseModel):
    """Chunk returned from a retrieval query."""

    chunk_id: str
    document_id: str
    score: float
    text: str
    metadata: Dict[str, Any]


class CollectionQueryRequest(BaseModel):
    """Payload for querying a collection."""

    query: str
    top_k: int = 5


class CollectionQueryResponse(BaseModel):
    """Response payload for collection queries."""

    query: str
    top_k: int
    chunks: List[RetrievedChunk]
    usage: Dict[str, Any]
    query_event_id: UUID | None = None
    pipeline_run_id: UUID | None = None
