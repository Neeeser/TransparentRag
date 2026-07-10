"""Default pipeline definitions mirroring the current ingestion and retrieval flows."""

from __future__ import annotations

from app.pipelines.definition import (
    PipelineDefinition,
    PipelineEdgeDefinition,
    PipelineNodeDefinition,
)
from app.pipelines.nodes.indexing import VectorIndexerNode, default_index_name
from app.pipelines.nodes.retrieval import VectorRetrieverNode
from app.pipelines.template import DEFAULT_NAMESPACE_TEMPLATE
from app.schemas.enums import IndexBackend
from app.services.app_config import get_app_config
from app.services.errors import InvalidInputError

# Horizontal spacing between scaffolded nodes; comfortably wider than the
# editor's rendered node cards so default pipelines never overlap.
NODE_SPACING_X = 340


def _default_backend() -> IndexBackend:
    """Return the deployment's configured default index backend."""
    return IndexBackend(get_app_config().indexing.default_backend)


def _resolve_embedding_model(explicit: str | None) -> str:
    """Return the model a scaffold embeds with, or fail pointing at setup.

    The code default is deliberately empty (no OpenRouter embedding model id
    is evergreen), so an install that has never run the first-run setup
    wizard has no model to scaffold with -- failing here, with a message
    that names the fix, beats a 502 on the first upload.
    """
    model = explicit or get_app_config().models.default_embedding_model
    if not model.strip():
        raise InvalidInputError(
            "No default embedding model is configured. Complete the "
            "first-time setup wizard (or set models.default_embedding_model) "
            "before creating default pipelines."
        )
    return model


def build_default_ingestion_pipeline(
    *,
    embedding_model: str | None = None,
    backend: IndexBackend | None = None,
    index_name: str | None = None,
    chunk_size: int = 1024,
    chunk_overlap: int = 200,
) -> PipelineDefinition:
    """Return the default ingestion pipeline definition.

    Explicit arguments (the setup wizard's confirmed choices) win over the
    runtime config; with no arguments this scaffolds from config and raises
    `InvalidInputError` when no embedding model has been configured yet.
    """
    backend = backend or _default_backend()
    embedding_model = _resolve_embedding_model(embedding_model)
    index_name = index_name or default_index_name(backend)
    nodes = [
        PipelineNodeDefinition(
            id="ingest-input",
            type="ingestion.input",
            name="Ingestion Input",
            position={"x": 0, "y": 0},
        ),
        PipelineNodeDefinition(
            id="parse-document",
            type="parser.document",
            name="Document Parser",
            position={"x": NODE_SPACING_X, "y": 0},
        ),
        PipelineNodeDefinition(
            id="chunk-document",
            type="chunker.token",
            name="Token Chunker",
            position={"x": NODE_SPACING_X * 2, "y": 0},
            config={
                "chunk_size": chunk_size,
                "chunk_overlap": chunk_overlap,
            },
        ),
        PipelineNodeDefinition(
            id="embed-chunks",
            type="embedder.openrouter",
            name="Embedder",
            position={"x": NODE_SPACING_X * 3, "y": 0},
            config={"model_name": embedding_model},
        ),
        PipelineNodeDefinition(
            id="index-chunks",
            type=VectorIndexerNode.type,
            name="Indexer",
            position={"x": NODE_SPACING_X * 4, "y": 0},
            config={
                "backend": backend.value,
                "index_name": index_name,
                "namespace": DEFAULT_NAMESPACE_TEMPLATE,
                "metric": "cosine",
                "ensure_index": True,
            },
        ),
        PipelineNodeDefinition(
            id="ingest-output",
            type="ingestion.output",
            name="Ingestion Output",
            position={"x": NODE_SPACING_X * 5, "y": 0},
        ),
    ]
    edges = [
        PipelineEdgeDefinition(
            id="edge-ingest-input-parser",
            source="ingest-input",
            target="parse-document",
            source_port="source",
            target_port="source",
        ),
        PipelineEdgeDefinition(
            id="edge-parser-chunker",
            source="parse-document",
            target="chunk-document",
            source_port="document",
            target_port="document",
        ),
        PipelineEdgeDefinition(
            id="edge-chunker-embedder",
            source="chunk-document",
            target="embed-chunks",
            source_port="chunks",
            target_port="chunks",
        ),
        PipelineEdgeDefinition(
            id="edge-embedder-indexer",
            source="embed-chunks",
            target="index-chunks",
            source_port="embedded",
            target_port="embedded",
        ),
        PipelineEdgeDefinition(
            id="edge-indexer-output",
            source="index-chunks",
            target="ingest-output",
            source_port="indexed",
            target_port="indexed",
        ),
    ]
    return PipelineDefinition(nodes=nodes, edges=edges, viewport={})


def build_default_retrieval_pipeline(
    *,
    embedding_model: str | None = None,
    backend: IndexBackend | None = None,
    index_name: str | None = None,
) -> PipelineDefinition:
    """Return the default retrieval pipeline definition.

    Same contract as `build_default_ingestion_pipeline`: explicit setup
    choices win over config; no configured model raises.
    """
    backend = backend or _default_backend()
    embedding_model = _resolve_embedding_model(embedding_model)
    index_name = index_name or default_index_name(backend)
    nodes = [
        PipelineNodeDefinition(
            id="query-input",
            type="retrieval.input",
            name="Retrieval Input",
            position={"x": 0, "y": 0},
        ),
        PipelineNodeDefinition(
            id="embed-query",
            type="embedder.openrouter",
            name="Embedder",
            position={"x": NODE_SPACING_X, "y": 0},
            config={"model_name": embedding_model},
        ),
        PipelineNodeDefinition(
            id="vector-retriever",
            type=VectorRetrieverNode.type,
            name="Retriever",
            position={"x": NODE_SPACING_X * 2, "y": 0},
            config={
                "backend": backend.value,
                "index_name": index_name,
                "namespace": DEFAULT_NAMESPACE_TEMPLATE,
            },
        ),
        PipelineNodeDefinition(
            id="retrieval-output",
            type="retrieval.output",
            name="Retrieval Output",
            position={"x": NODE_SPACING_X * 3, "y": 0},
        ),
    ]
    edges = [
        PipelineEdgeDefinition(
            id="edge-retrieval-input",
            source="query-input",
            target="embed-query",
            source_port="request",
            target_port="request",
        ),
        PipelineEdgeDefinition(
            id="edge-retrieval-embedder",
            source="embed-query",
            target="vector-retriever",
            source_port="query_embedding",
            target_port="query_embedding",
        ),
        PipelineEdgeDefinition(
            id="edge-retrieval-output",
            source="vector-retriever",
            target="retrieval-output",
            source_port="results",
            target_port="results",
        ),
    ]
    return PipelineDefinition(nodes=nodes, edges=edges, viewport={})
