from __future__ import annotations

from typing import Protocol, Sequence

from ..models import Document, DocumentChunk


class DocumentChunker(Protocol):
    """Protocol describing chunker implementations."""

    def chunk(self, document: Document) -> Sequence[DocumentChunk]:
        ...

