"""UMAP visualization tables: a projection run and its per-chunk 2D points."""

from __future__ import annotations

from uuid import UUID, uuid4

from sqlalchemy import Column, Float, String
from sqlmodel import Field, SQLModel

from app.db.models.user import TimestampMixin


class UmapProjectionRecord(SQLModel, TimestampMixin, table=True):
    """Stored metadata for a UMAP projection over collection chunks."""

    __tablename__ = "umap_projections"

    id: UUID = Field(default_factory=uuid4, primary_key=True, index=True)
    collection_id: UUID = Field(foreign_key="collections.id", nullable=False, index=True)
    user_id: UUID = Field(foreign_key="users.id", nullable=False, index=True)
    embedding_model: str = Field(sa_column=Column(String, nullable=False))
    n_neighbors: int = Field(default=15, nullable=False)
    min_dist: float = Field(default=0.1, sa_column=Column(Float, nullable=False))
    metric: str = Field(default="cosine", sa_column=Column(String, nullable=False))
    n_components: int = Field(default=2, nullable=False)
    random_state: int = Field(default=42, nullable=False)
    point_count: int = Field(default=0, nullable=False)


class UmapPointRecord(SQLModel, table=True):
    """Stored 2D UMAP coordinates for a document chunk."""

    __tablename__ = "umap_points"

    id: UUID = Field(default_factory=uuid4, primary_key=True, index=True)
    projection_id: UUID = Field(
        foreign_key="umap_projections.id",
        nullable=False,
        index=True,
    )
    chunk_id: UUID = Field(foreign_key="document_chunks.id", nullable=False, index=True)
    document_id: UUID = Field(foreign_key="documents.id", nullable=False, index=True)
    chunk_index: int = Field(nullable=False, index=True)
    x: float = Field(sa_column=Column(Float, nullable=False))
    y: float = Field(sa_column=Column(Float, nullable=False))
