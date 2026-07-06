"""Schemas for Pinecone index management APIs."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field, model_validator


class PineconeIndex(BaseModel):
    """Serialized Pinecone index metadata."""

    name: str
    vector_type: str | None = None
    metric: str | None = None
    dimension: int | None = None
    status: dict[str, Any] | None = None
    host: str | None = None
    spec: dict[str, Any] | None = None
    deletion_protection: str | None = None
    tags: dict[str, str] | None = None
    embed: dict[str, Any] | None = None


class PineconeIndexList(BaseModel):
    """List response for Pinecone indexes."""

    indexes: list[PineconeIndex] = Field(default_factory=list)


class PineconeIndexCreateRequest(BaseModel):
    """Payload for creating a serverless Pinecone index."""

    name: str = Field(min_length=1, max_length=45)
    vector_type: str = Field(default="dense")
    dimension: int | None = Field(default=None, gt=0)
    metric: str = Field(default="cosine")
    cloud: str | None = None
    region: str | None = None
    deletion_protection: str | None = None
    tags: dict[str, str] | None = None

    @model_validator(mode="after")
    def validate_dimension(self) -> PineconeIndexCreateRequest:
        """Ensure dense indexes define a dimension and sparse indexes do not."""
        if self.vector_type == "dense" and self.dimension is None:
            raise ValueError("Dense indexes require a dimension.")
        if self.vector_type == "sparse" and self.dimension is not None:
            raise ValueError("Sparse indexes must not define a dimension.")
        return self


class PineconeIndexDeleteResponse(BaseModel):
    """Response after deleting a Pinecone index."""

    status: str = "deleted"
