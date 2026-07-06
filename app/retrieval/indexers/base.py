"""Protocols and configs for vector index backends."""

from __future__ import annotations

from collections.abc import Sequence
from typing import Protocol, TypeVar

from pydantic import BaseModel

from ..models import DocumentChunk


class VectorIndexConfig(BaseModel):
    """Configuration for a vector index."""

    name: str
    namespace: str | None = None


ConfigT = TypeVar("ConfigT", bound=VectorIndexConfig, contravariant=True)


class Indexer(Protocol[ConfigT]):
    """Protocol describing write access to a vector index.

    Generic over the config type so a concrete indexer can declare its own
    `VectorIndexConfig` subtype (e.g. `PineconeIndexConfig`) as the parameter
    type -- narrowing without a `# type: ignore[override]` at the implementation.
    """

    def ensure_index(self, config: ConfigT) -> None:
        """Create or verify the index exists in the backend."""
        ...

    def upsert(
        self,
        config: ConfigT,
        chunks: Sequence[DocumentChunk],
        namespace: str | None = None,
    ) -> None:
        """Upsert document chunks into the backend index."""
        ...
