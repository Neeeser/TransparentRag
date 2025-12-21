from __future__ import annotations

from app.retrieval.chunkers import base as chunker_base
from app.retrieval.embedders import base as embedder_base
from app.retrieval.indexers import base as indexer_base
from app.retrieval.models import (
    Document,
    DocumentChunk,
    DocumentMetadata,
    QueryRequest,
    RetrievalResponse,
    ScoredChunk,
)
from app.retrieval.parsers import base as parser_base
from app.retrieval.rerankers import base as reranker_base
from app.retrieval.retrievers import base as retriever_base


def test_protocol_ellipsis_methods_execute() -> None:
    document = Document(document_id="doc-1", text="text", metadata=DocumentMetadata())
    chunk = DocumentChunk(
        document_id="doc-1",
        chunk_id="doc-1:0",
        text="text",
        order=0,
        metadata=DocumentMetadata(),
    )
    scored = ScoredChunk(chunk=chunk, score=0.5)
    request = QueryRequest(text="query")
    response = RetrievalResponse(matches=[scored])

    assert chunker_base.DocumentChunker.chunk(None, document) is None
    assert embedder_base.Embedder.embed_documents(None, [chunk]) is None
    assert embedder_base.Embedder.embed_query(None, "query") is None
    assert indexer_base.Indexer.ensure_index(None, indexer_base.VectorIndexConfig(name="idx")) is None
    assert indexer_base.Indexer.upsert(None, indexer_base.VectorIndexConfig(name="idx"), [chunk]) is None
    assert parser_base.DocumentParser.parse(None, parser_base.DocumentSource(document_id="doc", path="/tmp/doc")) is None
    assert retriever_base.Retriever.retrieve(None, request) is None
    assert reranker_base.Reranker.rerank(None, "query", [scored], top_k=1) is None
