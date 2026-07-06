from __future__ import annotations

from collections.abc import Sequence
from typing import Any

import pytest

from app.retrieval.indexers.base import VectorIndexConfig
from app.retrieval.indexing import DocumentIndexer
from app.retrieval.models import Document, DocumentChunk, DocumentMetadata
from app.retrieval.parsers.base import DocumentSource


class _StubChunker:
    def __init__(self, chunks: Sequence[DocumentChunk]) -> None:
        self._chunks = list(chunks)
        self.chunk_size = 2
        self.overlap = 0

    def chunk(self, _document: Document) -> Sequence[DocumentChunk]:
        return list(self._chunks)


class _StubEmbedder:
    def __init__(self, embeddings: Sequence[list[float]]) -> None:
        self._embeddings = list(embeddings)
        self.calls: list[list[DocumentChunk]] = []

    def embed_documents(self, chunks: Sequence[DocumentChunk]) -> Sequence[list[float]]:
        self.calls.append(list(chunks))
        return list(self._embeddings)


class _StubIndexer:
    def __init__(self) -> None:
        self.ensure_calls = 0
        self.upsert_calls: list[dict[str, Any]] = []

    def ensure_index(self, _config: VectorIndexConfig) -> None:
        self.ensure_calls += 1

    def upsert(
        self,
        *,
        config: VectorIndexConfig,
        chunks: Sequence[DocumentChunk],
        namespace: str | None = None,
    ) -> None:
        self.upsert_calls.append(
            {"config": config, "chunks": list(chunks), "namespace": namespace}
        )


class _StubParser:
    def __init__(self, document: Document) -> None:
        self.document = document
        self.calls: list[DocumentSource] = []

    def parse(self, source: DocumentSource) -> Document:
        self.calls.append(source)
        return self.document


def _document(text: str) -> Document:
    return Document(document_id="doc-1", text=text, metadata=DocumentMetadata())


def _chunk(text: str, idx: int) -> DocumentChunk:
    return DocumentChunk(
        document_id="doc-1",
        chunk_id=f"doc-1:{idx}",
        text=text,
        order=idx,
        metadata=DocumentMetadata(),
    )


def test_index_document_returns_empty_when_no_chunks(caplog) -> None:
    chunker = _StubChunker([])
    embedder = _StubEmbedder([])
    indexer = _StubIndexer()
    index_config = VectorIndexConfig(name="unit-index")
    service = DocumentIndexer(chunker, embedder, indexer, index_config)

    with caplog.at_level("WARNING"):
        result = service.index_document(_document(""))

    assert result == []
    assert indexer.ensure_calls == 1
    assert indexer.upsert_calls == []


def test_index_document_raises_on_embedding_mismatch() -> None:
    chunker = _StubChunker([_chunk("alpha", 0), _chunk("beta", 1)])
    embedder = _StubEmbedder([[0.1, 0.2]])
    indexer = _StubIndexer()
    index_config = VectorIndexConfig(name="unit-index")
    service = DocumentIndexer(chunker, embedder, indexer, index_config)

    with pytest.raises(ValueError, match="Mismatch between chunks and embeddings"):
        service.index_document(_document("alpha beta"))


def test_index_document_upserts_enriched_chunks_without_ensure() -> None:
    chunker = _StubChunker([_chunk("alpha", 0), _chunk("beta", 1)])
    embedder = _StubEmbedder([[0.1, 0.2], [0.3, 0.4]])
    indexer = _StubIndexer()
    index_config = VectorIndexConfig(name="unit-index", namespace="default")
    service = DocumentIndexer(chunker, embedder, indexer, index_config)

    result = service.index_document(_document("alpha beta"), ensure_index=False, namespace="ns")

    assert indexer.ensure_calls == 0
    assert len(indexer.upsert_calls) == 1
    stored = indexer.upsert_calls[0]
    assert stored["namespace"] == "ns"
    assert [chunk.embedding for chunk in stored["chunks"]] == [[0.1, 0.2], [0.3, 0.4]]
    assert result[0].embedding == [0.1, 0.2]


def test_index_source_requires_parser() -> None:
    chunker = _StubChunker([])
    embedder = _StubEmbedder([])
    indexer = _StubIndexer()
    index_config = VectorIndexConfig(name="unit-index")
    service = DocumentIndexer(chunker, embedder, indexer, index_config, parser=None)

    source = DocumentSource(document_id="doc-1", path="/tmp/test.txt")
    with pytest.raises(ValueError, match="Document parser is not configured"):
        service.index_source(source)


def test_index_sources_parses_and_batches_once() -> None:
    chunk = _chunk("alpha", 0)
    chunker = _StubChunker([chunk])
    embedder = _StubEmbedder([[0.1, 0.2]])
    indexer = _StubIndexer()
    index_config = VectorIndexConfig(name="unit-index")
    parser = _StubParser(_document("alpha"))
    service = DocumentIndexer(chunker, embedder, indexer, index_config, parser=parser)

    sources = [
        DocumentSource(document_id="doc-a", path="/tmp/a.txt"),
        DocumentSource(document_id="doc-b", path="/tmp/b.txt"),
    ]

    result = service.index_sources(sources)

    assert len(parser.calls) == 2
    assert indexer.ensure_calls == 1
    assert len(result) == 2


def test_index_batch_runs_once_for_multiple_documents() -> None:
    chunker = _StubChunker([_chunk("alpha", 0)])
    embedder = _StubEmbedder([[0.1, 0.2]])
    indexer = _StubIndexer()
    index_config = VectorIndexConfig(name="unit-index")
    service = DocumentIndexer(chunker, embedder, indexer, index_config)

    documents = [_document("alpha"), _document("beta")]
    result = service.index_batch(documents)

    assert len(result) == 2
    assert indexer.ensure_calls == 1


def test_index_sources_requires_parser() -> None:
    chunker = _StubChunker([])
    embedder = _StubEmbedder([])
    indexer = _StubIndexer()
    index_config = VectorIndexConfig(name="unit-index")
    service = DocumentIndexer(chunker, embedder, indexer, index_config, parser=None)

    sources = [DocumentSource(document_id="doc-1", path="/tmp/a.txt")]
    with pytest.raises(ValueError, match="Document parser is not configured"):
        service.index_sources(sources)
