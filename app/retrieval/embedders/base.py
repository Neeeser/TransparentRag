from __future__ import annotations

from typing import Protocol, Sequence

from ..models import DocumentChunk, EmbeddingVector


class Embedder(Protocol):
    """Protocol for embedding text chunks and queries."""

    model_name: str

    def embed_documents(self, chunks: Sequence[DocumentChunk]) -> Sequence[EmbeddingVector]:
        ...

    def embed_query(self, query: str) -> EmbeddingVector:
        ...

