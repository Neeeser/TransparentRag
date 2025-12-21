"""Protocols for document chunking."""

from __future__ import annotations

from typing import Protocol, Sequence

from ..models import Document, DocumentChunk


class DocumentChunker(Protocol):  # pylint: disable=too-few-public-methods
    """Protocol describing chunker implementations."""

    def chunk(self, document: Document) -> Sequence[DocumentChunk]:
        """Chunk the given document into smaller pieces."""
        return None
