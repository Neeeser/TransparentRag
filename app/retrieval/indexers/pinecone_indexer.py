"""Pinecone-based indexer implementation."""

from __future__ import annotations

import inspect
from typing import Any, Dict, Optional, Sequence

from pinecone import Pinecone, ServerlessSpec  # pylint: disable=no-name-in-module

from ..models import DocumentChunk
from ..pinecone import get_pinecone_client
from .base import Indexer, VectorIndexConfig


class PineconeIndexConfig(VectorIndexConfig):
    """Pinecone-specific index configuration."""

    dimension: int = 384
    metric: str = "cosine"
    cloud: str = "aws"
    region: str = "us-east-1"
    text_key: str = "text"
    deletion_protection: str = "disabled"
    metadata_config: Optional[Dict[str, Any]] = None
    serverless_spec: Optional[Dict[str, Any]] = None


class PineconeIndexer(Indexer):
    """Indexer implementation backed by Pinecone."""

    def __init__(
        self,
        client: Optional[Pinecone] = None,
        api_key: Optional[str] = None,
    ) -> None:
        """Initialize the Pinecone client wrapper."""
        self._client = get_pinecone_client(client=client, api_key=api_key)
        self._indexes: dict[str, Any] = {}

    def ensure_index(self, config: PineconeIndexConfig) -> None:
        """Create the Pinecone index if it does not already exist."""
        if self._client.has_index(config.name):
            return

        spec_kwargs = config.serverless_spec or {}
        spec_kwargs.setdefault("cloud", config.cloud)
        spec_kwargs.setdefault("region", config.region)
        spec = ServerlessSpec(**spec_kwargs)

        create_kwargs = {
            "name": config.name,
            "dimension": config.dimension,
            "metric": config.metric,
            "spec": spec,
            "deletion_protection": config.deletion_protection,
        }
        # Pinecone>=7 dropped the metadata_config kwarg, so only pass it when supported.
        if config.metadata_config:
            try:
                params = inspect.signature(self._client.create_index).parameters
            except (TypeError, ValueError):
                params = {}
            if "metadata_config" in params:
                create_kwargs["metadata_config"] = config.metadata_config

        self._client.create_index(**create_kwargs)

    def upsert(
        self,
        config: PineconeIndexConfig,
        chunks: Sequence[DocumentChunk],
        namespace: Optional[str] = None,
    ) -> None:
        """Upsert chunk vectors into Pinecone."""
        if not chunks:
            return

        namespace = namespace or config.namespace
        index = self._get_index(config.name)

        vectors: list[Dict[str, Any]] = []
        for chunk in chunks:
            if chunk.embedding is None:
                raise ValueError(f"Chunk {chunk.chunk_id} missing embedding.")
            metadata = dict(chunk.metadata.data)
            metadata["document_id"] = chunk.document_id
            metadata["order"] = chunk.order
            metadata[config.text_key] = chunk.text
            vectors.append(
                {
                    "id": chunk.chunk_id,
                    "values": chunk.embedding,
                    "metadata": metadata,
                }
            )

        index.upsert(vectors=vectors, namespace=namespace)

    def delete_index(self, name: str) -> None:
        """Delete an index by name and evict cached handles."""
        if self._client.has_index(name):
            self._client.delete_index(name)
        self._indexes.pop(name, None)

    def _get_index(self, name: str) -> Any:
        """Return a cached index handle."""
        if name not in self._indexes:
            self._indexes[name] = self._client.Index(name)
        return self._indexes[name]
