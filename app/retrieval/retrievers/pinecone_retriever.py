from __future__ import annotations

import os
from typing import Any, Optional, Sequence

from pinecone import Pinecone

from ..embedders.base import Embedder
from ..indexers.pinecone_indexer import PineconeIndexConfig
from ..models import DocumentChunk, DocumentMetadata, QueryRequest, RetrievalResponse, ScoredChunk
from ..rerankers.base import Reranker
from .base import Retriever


class PineconeRetriever(Retriever):
    """Retriever backed by Pinecone with optional reranking."""

    def __init__(
        self,
        index_config: PineconeIndexConfig,
        embedder: Embedder,
        client: Optional[Pinecone] = None,
        api_key: Optional[str] = None,
        reranker: Optional[Reranker] = None,
    ) -> None:
        resolved_api_key = api_key or os.getenv("PINECONE_API_KEY")
        if client is None:
            if not resolved_api_key:
                raise ValueError("Pinecone API key must be provided via argument or PINECONE_API_KEY env var.")
            client = Pinecone(api_key=resolved_api_key)
        self._client = client
        self._index_config = index_config
        self._embedder = embedder
        self._reranker = reranker
        self._index = self._client.Index(index_config.name)

    def retrieve(self, request: QueryRequest) -> RetrievalResponse:
        query_vector = self._embedder.embed_query(request.text)
        namespace = request.namespace or self._index_config.namespace

        result = self._index.query(
            vector=query_vector,
            top_k=request.top_k,
            include_metadata=True,
            include_values=False,
            namespace=namespace,
            filter=request.filter,
        )

        scored_chunks = self._convert_matches(result.matches)

        if self._reranker is not None:
            reranked = self._reranker.rerank(
                query=request.text,
                candidates=scored_chunks,
                top_k=request.top_k,
            )
            return RetrievalResponse(matches=list(reranked))

        return RetrievalResponse(matches=scored_chunks)

    def _convert_matches(self, matches: Sequence[Any]) -> list[ScoredChunk]:
        scored: list[ScoredChunk] = []
        for match in matches:
            metadata_dict = dict(match.metadata or {})
            text = metadata_dict.pop(self._index_config.text_key, "")
            document_id = metadata_dict.pop("document_id", match.id)
            order = metadata_dict.pop("order", 0)
            chunk = DocumentChunk(
                document_id=document_id,
                chunk_id=match.id,
                text=text,
                order=int(order),
                metadata=DocumentMetadata(data=metadata_dict),
            )
            scored.append(ScoredChunk(chunk=chunk, score=float(match.score)))
        return scored

