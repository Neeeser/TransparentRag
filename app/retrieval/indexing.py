from __future__ import annotations

from typing import Optional, Sequence

from .chunkers.base import DocumentChunker
from .embedders.base import Embedder
from .indexers.base import Indexer, VectorIndexConfig
from .models import Document, DocumentChunk
from .parsers import DocumentParser, DocumentSource


class DocumentIndexer:
    """Coordinates chunking, embedding, and upserting documents into a vector index."""

    def __init__(
        self,
        chunker: DocumentChunker,
        embedder: Embedder,
        indexer: Indexer,
        index_config: VectorIndexConfig,
        parser: Optional[DocumentParser] = None,
    ) -> None:
        self._chunker = chunker
        self._embedder = embedder
        self._indexer = indexer
        self._index_config = index_config
        self._parser = parser

    def ensure_index(self) -> None:
        self._indexer.ensure_index(self._index_config)

    def index_document(
        self,
        document: Document,
        namespace: Optional[str] = None,
        ensure_index: bool = True,
    ) -> Sequence[DocumentChunk]:
        if ensure_index:
            self.ensure_index()

        chunks = list(self._chunker.chunk(document))
        if not chunks:
            return []

        embeddings = self._embedder.embed_documents(chunks)
        if len(embeddings) != len(chunks):
            raise ValueError("Mismatch between chunks and embeddings.")

        enriched_chunks = [
            chunk.with_embedding(embedding)
            for chunk, embedding in zip(chunks, embeddings)
        ]

        self._indexer.upsert(
            config=self._index_config,
            chunks=enriched_chunks,
            namespace=namespace,
        )
        return enriched_chunks

    def index_source(
        self,
        source: DocumentSource,
        namespace: Optional[str] = None,
        ensure_index: bool = True,
    ) -> Sequence[DocumentChunk]:
        if self._parser is None:
            raise ValueError("Document parser is not configured for this indexer.")
        document = self._parser.parse(source)
        return self.index_document(
            document=document,
            namespace=namespace,
            ensure_index=ensure_index,
        )

    def index_batch(
        self,
        documents: Sequence[Document],
        namespace: Optional[str] = None,
        ensure_index: bool = True,
    ) -> list[DocumentChunk]:
        combined: list[DocumentChunk] = []
        for document in documents:
            combined.extend(
                self.index_document(
                    document=document,
                    namespace=namespace,
                    ensure_index=ensure_index,
                )
            )
            ensure_index = False  # ensure only on first pass if requested
        return combined

    def index_sources(
        self,
        sources: Sequence[DocumentSource],
        namespace: Optional[str] = None,
        ensure_index: bool = True,
    ) -> list[DocumentChunk]:
        if self._parser is None:
            raise ValueError("Document parser is not configured for this indexer.")

        combined: list[DocumentChunk] = []
        for source in sources:
            combined.extend(
                self.index_source(
                    source=source,
                    namespace=namespace,
                    ensure_index=ensure_index,
                )
            )
            ensure_index = False  # ensure only on first pass if requested
        return combined
