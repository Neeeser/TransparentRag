"""Registry of available pipeline nodes."""

from __future__ import annotations

from app.pipelines.nodes.ingestion import (
    ChunkerNode,
    DocumentParserNode,
    EmbedderNode,
    FileTypeRouterNode,
    IndexerNode,
    IngestionInputNode,
    IngestionOutputNode,
    ParagraphChunkerNode,
    SemanticChunkerNode,
    SentenceChunkerNode,
    TokenChunkerNode,
)
from app.pipelines.nodes.retrieval import (
    ChatSettingsNode,
    PineconeRetrieverNode,
    RerankerNode,
    RetrievalInputNode,
    RetrievalOutputNode,
)
from app.pipelines.runtime import NodeRegistry


def build_default_registry() -> NodeRegistry:
    """Return the registry containing all built-in nodes."""
    return NodeRegistry(
        [
            IngestionInputNode,
            DocumentParserNode,
            FileTypeRouterNode,
            ChunkerNode,
            TokenChunkerNode,
            SentenceChunkerNode,
            ParagraphChunkerNode,
            SemanticChunkerNode,
            EmbedderNode,
            IndexerNode,
            IngestionOutputNode,
            RetrievalInputNode,
            PineconeRetrieverNode,
            RerankerNode,
            RetrievalOutputNode,
            ChatSettingsNode,
        ]
    )
