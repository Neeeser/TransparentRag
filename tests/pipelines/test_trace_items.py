"""Result-identity coverage for item-capable pipeline trace summaries."""

from __future__ import annotations

from uuid import uuid4

from sqlmodel import Session

from app.core.config import get_settings
from app.db import models
from app.db.models import ChunkStrategy
from app.pipelines.definition import (
    PipelineDefinition,
    PipelineEdgeDefinition,
    PipelineNodeDefinition,
)
from app.pipelines.execution.context import PipelineRunContext
from app.pipelines.execution.executor import PipelineExecutor
from app.pipelines.node import PipelineNodeBase
from app.pipelines.nodes.chunking import ChunkerConfig, ChunkerNode
from app.pipelines.nodes.embedding import EmbedderConfig, EmbedderNode
from app.pipelines.nodes.fusion import RRFusionConfig, RRFusionNode
from app.pipelines.nodes.indexing import (
    Bm25IndexerConfig,
    Bm25IndexerNode,
    VectorIndexerConfig,
    VectorIndexerNode,
)
from app.pipelines.nodes.retrieval import (
    Bm25RetrieverConfig,
    Bm25RetrieverNode,
    RerankerConfig,
    RerankerNode,
    VectorRetrieverConfig,
    VectorRetrieverNode,
)
from app.pipelines.payloads import (
    ChunkPayload,
    EmbeddingPayload,
    IndexingPayload,
    ParsedDocumentPayload,
    QueryEmbeddingPayload,
    RetrievalPayload,
    RetrievalRequestPayload,
    TokenizerSpec,
)
from app.pipelines.ports import NodePort
from app.pipelines.registry import NodeRegistry
from app.pipelines.tracing import NodeTraceSummary, NodeTraceValue
from app.retrieval.models import (
    Document,
    DocumentChunk,
    DocumentMetadata,
    QueryRequest,
    RetrievalResponse,
    ScoredChunk,
)
from app.schemas.enums import IndexBackend
from app.utils.file_storage import FileStorage
from tests.pipelines.conftest import StubProviderResolver, StubVectorStoreProvider


def _chunks(count: int) -> list[DocumentChunk]:
    return [
        DocumentChunk(
            document_id="doc",
            chunk_id=f"doc:{index}",
            text=f"chunk {index}",
            order=index,
            metadata=DocumentMetadata(),
            embedding=[index / 10, index / 20],
        )
        for index in range(count)
    ]


def _matches(ids: list[str]) -> list[ScoredChunk]:
    chunks = {chunk.chunk_id: chunk for chunk in _chunks(20)}
    return [
        ScoredChunk(chunk=chunks[chunk_id], score=1.0 - rank / 100)
        for rank, chunk_id in enumerate(ids, start=1)
    ]


def _item_values(values: list[NodeTraceValue]) -> list[object]:
    item_values = [value.value for value in values if value.kind == "items"]
    assert item_values, "node summary did not emit an items value"
    return item_values


def _refs(value: object) -> list[tuple[str, float | None]]:
    kind = getattr(value, "kind", None)
    assert kind in {"chunks", "matches"}
    return [(item.id, item.score) for item in value.items]


def test_linear_ingestion_preserves_every_chunk_id_through_each_node() -> None:
    document = Document(document_id="doc", text="source", metadata=DocumentMetadata())
    chunks = _chunks(12)
    parsed = ParsedDocumentPayload(document=document)
    chunked = ChunkPayload(document=document, chunks=chunks)
    embedded = EmbeddingPayload(document=document, chunks=chunks)
    indexed = IndexingPayload(document=document, chunks=chunks)

    chunker = ChunkerNode(
        ChunkerConfig(strategy=ChunkStrategy.TOKEN, chunk_size=10, chunk_overlap=0)
    )
    embedder = EmbedderNode(EmbedderConfig(connection_id=uuid4(), model_name="embed"))
    vector_indexer = VectorIndexerNode(
        VectorIndexerConfig(
            backend=IndexBackend.PGVECTOR,
            index_name="docs",
            dimension=2,
        )
    )
    bm25_indexer = Bm25IndexerNode(
        Bm25IndexerConfig(backend=IndexBackend.PGVECTOR, index_name="docs-bm25")
    )

    summaries = [
        chunker.summarize_io({"document": parsed}, {"chunks": chunked}),
        embedder.summarize_io({"chunks": chunked}, {"embedded": embedded}),
        vector_indexer.summarize_io({"embedded": embedded}, {"indexed": indexed}),
        bm25_indexer.summarize_io({"chunks": chunked}, {"indexed": indexed}),
    ]
    expected = [(f"doc:{index}", None) for index in range(12)]

    assert _refs(_item_values(summaries[0].outputs)[0]) == expected
    for summary in summaries[1:]:
        assert _refs(_item_values(summary.inputs)[0]) == expected
        assert _refs(_item_values(summary.outputs)[0]) == expected


def test_hybrid_fanout_keeps_provider_splits_inside_the_embedder() -> None:
    document = Document(document_id="doc", text="source", metadata=DocumentMetadata())
    oversized = " ".join(f"token-{index}" for index in range(50))
    chunks = [
        DocumentChunk(
            document_id="doc",
            chunk_id="doc:7",
            text=oversized,
            order=7,
            metadata=DocumentMetadata(),
        ),
        DocumentChunk(
            document_id="doc",
            chunk_id="doc:8",
            text="tail",
            order=8,
            metadata=DocumentMetadata(),
        ),
    ]
    payload = ChunkPayload(
        document=document,
        chunks=chunks,
        tokenizer=TokenizerSpec(kind="whitespace"),
    )

    class _SourceNode(PipelineNodeBase):
        type = "test.trace_source"
        label = "Source"
        category = "test"
        description = "Emit the test chunk batch."
        example = "Source -> Chunks."
        input_ports = ()
        output_ports = (NodePort(key="chunks", label="Chunks", data_type="chunk_batch"),)

        def run(self, inputs: dict[str, object], context: PipelineRunContext) -> dict[str, object]:
            return {"chunks": payload}

        def summarize_io(self, inputs: dict[str, object], outputs: dict[str, object]) -> None:
            return None

    class _LexicalNode(PipelineNodeBase):
        type = "test.trace_lexical"
        label = "Lexical"
        category = "test"
        description = "Observe the lexical fan-out input."
        example = "Chunks -> Chunks."
        input_ports = (NodePort(key="chunks", label="Chunks", data_type="chunk_batch"),)
        output_ports = (NodePort(key="chunks", label="Chunks", data_type="chunk_batch"),)

        def run(self, inputs: dict[str, object], context: PipelineRunContext) -> dict[str, object]:
            return {"chunks": ChunkPayload.model_validate(inputs["chunks"])}

        def summarize_io(self, inputs: dict[str, object], outputs: dict[str, object]) -> None:
            return None

    class _RecordingEmbedder:
        def __init__(self, *_args: object, **_kwargs: object) -> None:
            self.usage: dict[str, int] = {}

        def embed_documents(self, provider_chunks: list[DocumentChunk]) -> list[list[float]]:
            return [[0.1, 0.2] for _ in provider_chunks]

        def embed_query(self, _query: str) -> list[float]:
            return [0.1, 0.2]

    connection_id = uuid4()
    definition = PipelineDefinition(
        nodes=[
            PipelineNodeDefinition(id="source", type=_SourceNode.type, name="Source"),
            PipelineNodeDefinition(
                id="embed",
                type=EmbedderNode.type,
                name="Embedder",
                config={"connection_id": str(connection_id), "model_name": "embed"},
            ),
            PipelineNodeDefinition(id="lexical", type=_LexicalNode.type, name="Lexical"),
        ],
        edges=[
            PipelineEdgeDefinition(
                id="dense", source="source", target="embed", source_port="chunks", target_port="chunks"
            ),
            PipelineEdgeDefinition(
                id="lexical",
                source="source",
                target="lexical",
                source_port="chunks",
                target_port="chunks",
            ),
        ],
    )
    user = models.User(email="trace@test.local", hashed_password="hashed")
    collection = models.Collection(user_id=user.id, name="Trace", description="")
    context = PipelineRunContext(
        session=Session(),
        user=user,
        collection=collection,
        document=None,
        query=None,
        top_k=None,
        providers=StubProviderResolver(_RecordingEmbedder, embedding_input_limit=56),
        vector_stores=StubVectorStoreProvider(),
        storage=FileStorage(),
        settings=get_settings(),
    )

    result = PipelineExecutor(NodeRegistry([_SourceNode, EmbedderNode, _LexicalNode])).execute(
        definition, context
    )
    lexical = ChunkPayload.model_validate(result.outputs_by_node["lexical"]["chunks"])
    embedded = EmbeddingPayload.model_validate(result.outputs_by_node["embed"]["embedded"])

    assert [chunk.chunk_id for chunk in lexical.chunks] == ["doc:7", "doc:8"]
    assert [chunk.chunk_id for chunk in embedded.chunks] == ["doc:7", "doc:8"]


def test_retrievers_keep_full_filtered_match_order_and_scores() -> None:
    filtered_ids = [f"doc:{index}" for index in range(0, 18, 2)]
    matches = _matches(filtered_ids)
    request = QueryRequest(text="query", top_k=20, filter={"category": "kept"})
    dense_input = QueryEmbeddingPayload(request=request, embedding=[0.1, 0.2])
    lexical_input = RetrievalRequestPayload(request=request)
    output = RetrievalPayload(response=RetrievalResponse(matches=matches))
    dense = VectorRetrieverNode(
        VectorRetrieverConfig(backend=IndexBackend.PGVECTOR, index_name="docs")
    )
    lexical = Bm25RetrieverNode(
        Bm25RetrieverConfig(backend=IndexBackend.PGVECTOR, index_name="docs-bm25")
    )

    dense_summary = dense.summarize_io({"query_embedding": dense_input}, {"results": output})
    lexical_summary = lexical.summarize_io({"request": lexical_input}, {"results": output})
    expected = [(match.chunk.chunk_id, match.score) for match in matches]

    assert len(matches) > 5
    assert _refs(_item_values(dense_summary.outputs)[0]) == expected
    assert _refs(_item_values(lexical_summary.outputs)[0]) == expected


def test_rrf_summary_preserves_each_branch_and_complete_fused_order() -> None:
    branch_one = RetrievalPayload(
        response=RetrievalResponse(matches=_matches(["doc:0", "doc:1", "doc:2"]))
    )
    branch_two = RetrievalPayload(
        response=RetrievalResponse(matches=_matches(["doc:1", "doc:3"]))
    )
    fused_matches = _matches(["doc:1", "doc:0", "doc:3", "doc:2"])
    fused = RetrievalPayload(response=RetrievalResponse(matches=fused_matches))
    summary = RRFusionNode(RRFusionConfig()).summarize_io(
        {"results": [branch_one, branch_two]},
        {"results": fused},
    )

    branch_traces = _item_values(summary.inputs)
    assert [_refs(value) for value in branch_traces] == [
        [(match.chunk.chunk_id, match.score) for match in branch_one.response.matches],
        [(match.chunk.chunk_id, match.score) for match in branch_two.response.matches],
    ]
    assert _refs(_item_values(summary.outputs)[0]) == [
        (match.chunk.chunk_id, match.score) for match in fused_matches
    ]


def test_reranker_summary_keeps_complete_before_and_after_orders() -> None:
    before_matches = _matches([f"doc:{index}" for index in range(12)])
    after_matches = [
        match.model_copy(update={"score": match.score + 0.25})
        for match in reversed(before_matches)
    ]
    before = RetrievalPayload(response=RetrievalResponse(matches=before_matches))
    after = RetrievalPayload(response=RetrievalResponse(matches=after_matches))

    summary = RerankerNode(RerankerConfig(enabled=True)).summarize_io(
        {"results": before},
        {"results": after},
    )

    assert _refs(_item_values(summary.inputs)[0]) == [
        (match.chunk.chunk_id, match.score) for match in before_matches
    ]
    assert _refs(_item_values(summary.outputs)[0]) == [
        (match.chunk.chunk_id, match.score) for match in after_matches
    ]


def test_non_item_summary_has_no_item_trace() -> None:
    summary = NodeTraceSummary(outputs=[NodeTraceValue(label="Text", value="plain", kind="text")])

    assert [value for value in summary.outputs if value.kind == "items"] == []
