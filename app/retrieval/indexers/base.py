"""Protocols and configs for vector index backends."""

from __future__ import annotations

from collections.abc import Sequence
from typing import Protocol

from pydantic import BaseModel

from ..models import DocumentChunk


class VectorIndexConfig(BaseModel):
    """Configuration for a vector index."""

    name: str
    namespace: str | None = None


class Indexer(Protocol):
    """Protocol describing write access to a vector index."""

    def ensure_index(self, config: VectorIndexConfig) -> None:
        """Create or verify the index exists in the backend."""
        return None

    def upsert(
        self,
        config: VectorIndexConfig,
        chunks: Sequence[DocumentChunk],
        namespace: str | None = None,
    ) -> None:
        """Upsert document chunks into the backend index."""
        return None
