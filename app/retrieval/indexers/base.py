from __future__ import annotations

from typing import Optional, Protocol, Sequence

from pydantic import BaseModel

from ..models import DocumentChunk


class VectorIndexConfig(BaseModel):
    name: str
    namespace: Optional[str] = None


class Indexer(Protocol):
    """Protocol describing write access to a vector index."""

    def ensure_index(self, config: VectorIndexConfig) -> None:
        ...

    def upsert(
        self,
        config: VectorIndexConfig,
        chunks: Sequence[DocumentChunk],
        namespace: Optional[str] = None,
    ) -> None:
        ...

