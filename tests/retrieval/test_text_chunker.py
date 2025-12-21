from __future__ import annotations

import pytest

from app.retrieval.chunkers.text import FixedSizeTextChunker
from app.retrieval.models import Document, DocumentMetadata


def _document(text: str) -> Document:
    return Document(document_id="doc-1", text=text, metadata=DocumentMetadata(data={"source": "unit"}))


def test_fixed_size_chunker_rejects_invalid_settings() -> None:
    with pytest.raises(ValueError, match="chunk_size must be positive"):
        FixedSizeTextChunker(chunk_size=0, overlap=0)

    with pytest.raises(ValueError, match="overlap must be non-negative"):
        FixedSizeTextChunker(chunk_size=10, overlap=-1)

    with pytest.raises(ValueError, match="overlap must be smaller"):
        FixedSizeTextChunker(chunk_size=5, overlap=5)


def test_fixed_size_chunker_returns_empty_for_blank_text() -> None:
    chunker = FixedSizeTextChunker(chunk_size=3, overlap=1)

    chunks = chunker.chunk(_document("   \n\t"))

    assert chunks == []


def test_fixed_size_chunker_splits_and_copies_metadata() -> None:
    text = "one two three four five six"
    chunker = FixedSizeTextChunker(chunk_size=3, overlap=1)

    chunks = chunker.chunk(_document(text))

    assert [chunk.chunk_id for chunk in chunks] == ["doc-1:0", "doc-1:1", "doc-1:2"]
    assert [chunk.text for chunk in chunks] == ["one two three", "three four five", "five six"]
    assert chunks[0].metadata.data == {"source": "unit"}
    assert chunks[0].metadata is not chunks[1].metadata
