"""TransparentRAG retrieval module."""

# NOTE: Keep imports lightweight so optional dependencies (e.g. transformers)
# are not pulled in when the retrieval package is imported. Users that need
# concrete implementations such as SentenceTransformerEmbedder can import
# those modules directly.

from .chunkers import DocumentChunker
from .embedders import Embedder
from .indexers import Indexer, PineconeIndexConfig, PineconeIndexer, VectorIndexConfig
from .indexing import DocumentIndexer
from .models import (
    Document,
    DocumentChunk,
    DocumentMetadata,
    QueryRequest,
    RetrievalResponse,
    ScoredChunk,
)
from .parsers import DocumentParser, DocumentSource
from .rerankers import Reranker
from .retrievers import PineconeRetriever, Retriever

__all__ = [
    "Document",
    "DocumentChunk",
    "DocumentChunker",
    "DocumentIndexer",
    "DocumentMetadata",
    "DocumentParser",
    "DocumentSource",
    "Embedder",
    "Indexer",
    "PineconeIndexConfig",
    "PineconeIndexer",
    "PineconeRetriever",
    "QueryRequest",
    "Reranker",
    "RetrievalResponse",
    "Retriever",
    "ScoredChunk",
    "VectorIndexConfig",
]
