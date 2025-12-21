"""Shared retrieval domain models."""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Sequence

from pydantic import BaseModel, Field

EmbeddingVector = List[float]


class DocumentMetadata(BaseModel):
    """Typed metadata container for documents and chunks."""

    data: Dict[str, Any] = Field(default_factory=dict)


class Document(BaseModel):
    """Document payload for ingestion and retrieval."""

    document_id: str
    text: str
    metadata: DocumentMetadata = Field(default_factory=DocumentMetadata)


class DocumentChunk(BaseModel):
    """Chunked view of a document with optional embedding."""

    document_id: str
    chunk_id: str
    text: str
    order: int
    metadata: DocumentMetadata = Field(default_factory=DocumentMetadata)
    embedding: Optional[EmbeddingVector] = None

    def with_embedding(self, embedding: EmbeddingVector) -> "DocumentChunk":
        """Return a copy of the chunk populated with an embedding."""
        chunk = self.model_copy()
        chunk.embedding = embedding
        return chunk


class IndexMetadata(BaseModel):
    """Vector index configuration details."""

    metric: str = "cosine"
    dimension: int = 384
    namespace: Optional[str] = None
    spec: Dict[str, Any] = Field(default_factory=dict)


class ChunkBatch(BaseModel):
    """Batch of chunks prepared for indexing."""

    chunks: Sequence[DocumentChunk]


class QueryRequest(BaseModel):
    """Request data for a vector similarity query."""

    text: str
    top_k: int = 5
    namespace: Optional[str] = None
    filter: Optional[Dict[str, Any]] = None


class ScoredChunk(BaseModel):
    """Chunk with a similarity score."""

    chunk: DocumentChunk
    score: float


class RetrievalResponse(BaseModel):
    """Response payload for retrieval results."""

    matches: List[ScoredChunk]


__all__ = [
    "ChunkBatch",
    "Document",
    "DocumentChunk",
    "DocumentMetadata",
    "EmbeddingVector",
    "IndexMetadata",
    "QueryRequest",
    "RetrievalResponse",
    "ScoredChunk",
]
