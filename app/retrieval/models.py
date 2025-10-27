from __future__ import annotations

from typing import Any, Dict, List, Optional, Sequence

from pydantic import BaseModel, Field

EmbeddingVector = List[float]


class DocumentMetadata(BaseModel):
    data: Dict[str, Any] = Field(default_factory=dict)


class Document(BaseModel):
    document_id: str
    text: str
    metadata: DocumentMetadata = Field(default_factory=DocumentMetadata)


class DocumentChunk(BaseModel):
    document_id: str
    chunk_id: str
    text: str
    order: int
    metadata: DocumentMetadata = Field(default_factory=DocumentMetadata)
    embedding: Optional[EmbeddingVector] = None

    def with_embedding(self, embedding: EmbeddingVector) -> "DocumentChunk":
        chunk = self.model_copy()
        chunk.embedding = embedding
        return chunk


class IndexMetadata(BaseModel):
    metric: str = "cosine"
    dimension: int = 384
    namespace: Optional[str] = None
    spec: Dict[str, Any] = Field(default_factory=dict)


class ChunkBatch(BaseModel):
    chunks: Sequence[DocumentChunk]


class QueryRequest(BaseModel):
    text: str
    top_k: int = 5
    namespace: Optional[str] = None
    filter: Optional[Dict[str, Any]] = None


class ScoredChunk(BaseModel):
    chunk: DocumentChunk
    score: float


class RetrievalResponse(BaseModel):
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
