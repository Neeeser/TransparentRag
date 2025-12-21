"""Protocols for embedding text into vectors."""

from __future__ import annotations

from typing import Protocol, Sequence

from ..models import DocumentChunk, EmbeddingVector


class Embedder(Protocol):
    """Protocol for embedding text chunks and queries."""

    model_name: str

    def embed_documents(self, chunks: Sequence[DocumentChunk]) -> Sequence[EmbeddingVector]:
        """Embed a sequence of document chunks."""
        return None

    def embed_query(self, query: str) -> EmbeddingVector:
        """Embed a query string into a vector."""
        return None
