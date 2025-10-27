from __future__ import annotations

from typing import Sequence

from .base import DocumentChunker
from ..models import Document, DocumentChunk


class FixedSizeTextChunker(DocumentChunker):
    """Simple whitespace tokenizer with overlap handling."""

    def __init__(self, chunk_size: int = 200, overlap: int = 40) -> None:
        if chunk_size <= 0:
            raise ValueError("chunk_size must be positive")
        if overlap < 0:
            raise ValueError("overlap must be non-negative")
        if overlap >= chunk_size:
            raise ValueError("overlap must be smaller than chunk_size")
        self.chunk_size = chunk_size
        self.overlap = overlap

    def chunk(self, document: Document) -> Sequence[DocumentChunk]:
        words = document.text.split()
        if not words:
            return []

        step = self.chunk_size - self.overlap
        chunks: list[DocumentChunk] = []

        for i in range(0, len(words), step):
            window = words[i : i + self.chunk_size]
            if not window:
                continue

            chunk_text = " ".join(window)
            chunk = DocumentChunk(
                document_id=document.document_id,
                chunk_id=f"{document.document_id}:{len(chunks)}",
                text=chunk_text,
                order=len(chunks),
                metadata=document.metadata.model_copy(deep=True),
            )
            chunks.append(chunk)

        return chunks

