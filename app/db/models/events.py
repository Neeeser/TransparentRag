"""Audit-event tables: ingestion outcomes and retrieval query records."""

from __future__ import annotations

from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import JSON, Column, Float, String, Text
from sqlmodel import Field, SQLModel

from app.db.models.user import TimestampMixin


class IngestionEvent(SQLModel, TimestampMixin, table=True):
    """Ingestion event audit record."""

    __tablename__ = "ingestion_events"

    id: UUID = Field(default_factory=uuid4, primary_key=True, index=True)
    document_id: UUID = Field(foreign_key="documents.id", nullable=False, index=True)
    collection_id: UUID = Field(foreign_key="collections.id", nullable=False, index=True)
    event_type: str = Field(sa_column=Column(String, nullable=False))
    status: str = Field(sa_column=Column(String, nullable=False))
    details: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON, nullable=False))


class QueryEvent(SQLModel, TimestampMixin, table=True):
    """Query audit record for retrieval events."""

    __tablename__ = "query_events"

    id: UUID = Field(default_factory=uuid4, primary_key=True, index=True)
    user_id: UUID = Field(foreign_key="users.id", nullable=False, index=True)
    collection_id: UUID = Field(foreign_key="collections.id", nullable=False, index=True)
    query_text: str = Field(sa_column=Column(Text, nullable=False))
    top_k: int = Field(default=5, nullable=False)
    model: str = Field(sa_column=Column(String, nullable=False))
    context_tokens: int = Field(default=0, nullable=False)
    latency_ms: float = Field(default=0.0, sa_column=Column(Float, nullable=False))
    response_payload: dict[str, Any] = Field(
        default_factory=dict,
        sa_column=Column(JSON, nullable=False),
    )
    pipeline_run_id: UUID | None = Field(
        default=None,
        foreign_key="pipeline_runs.id",
        nullable=True,
        index=True,
    )
