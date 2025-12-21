"""Protocols and configs for vector index backends."""

from __future__ import annotations

from typing import Optional, Protocol, Sequence

from pydantic import BaseModel

from ..models import DocumentChunk


class VectorIndexConfig(BaseModel):
    """Configuration for a vector index."""

    name: str
    namespace: Optional[str] = None


class Indexer(Protocol):
    """Protocol describing write access to a vector index."""

    def ensure_index(self, config: VectorIndexConfig) -> None:
        """Create or verify the index exists in the backend."""
        return None

    def upsert(
        self,
        config: VectorIndexConfig,
        chunks: Sequence[DocumentChunk],
        namespace: Optional[str] = None,
    ) -> None:
        """Upsert document chunks into the backend index."""
        return None
