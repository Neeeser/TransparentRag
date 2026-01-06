"""Schemas for Pinecone index management APIs."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, model_validator


class PineconeIndex(BaseModel):
    """Serialized Pinecone index metadata."""

    name: str
    vector_type: Optional[str] = None
    metric: Optional[str] = None
    dimension: Optional[int] = None
    status: Optional[Dict[str, Any]] = None
    host: Optional[str] = None
    spec: Optional[Dict[str, Any]] = None
    deletion_protection: Optional[str] = None
    tags: Optional[Dict[str, str]] = None
    embed: Optional[Dict[str, Any]] = None


class PineconeIndexList(BaseModel):
    """List response for Pinecone indexes."""

    indexes: List[PineconeIndex] = Field(default_factory=list)


class PineconeIndexCreateRequest(BaseModel):
    """Payload for creating a serverless Pinecone index."""

    name: str = Field(min_length=1, max_length=45)
    vector_type: str = Field(default="dense")
    dimension: Optional[int] = Field(default=None, gt=0)
    metric: str = Field(default="cosine")
    cloud: Optional[str] = None
    region: Optional[str] = None
    deletion_protection: Optional[str] = None
    tags: Optional[Dict[str, str]] = None

    @model_validator(mode="after")
    def validate_dimension(self) -> "PineconeIndexCreateRequest":
        """Ensure dense indexes define a dimension and sparse indexes do not."""
        if self.vector_type == "dense" and self.dimension is None:
            raise ValueError("Dense indexes require a dimension.")
        if self.vector_type == "sparse" and self.dimension is not None:
            raise ValueError("Sparse indexes must not define a dimension.")
        return self


class PineconeIndexDeleteResponse(BaseModel):
    """Response after deleting a Pinecone index."""

    status: str = "deleted"
