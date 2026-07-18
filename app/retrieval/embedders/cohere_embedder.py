"""Cohere retrieval embedder with query/document input type separation."""

from __future__ import annotations

from collections.abc import Sequence

from app.clients.cohere import CohereClient
from app.clients.cohere.schemas import CohereEmbedResponse
from app.retrieval.embedders.base import Embedder
from app.retrieval.models import DocumentChunk, EmbeddingVector


class CohereEmbedder(Embedder):
    """Embed documents and queries through Cohere's v2 embed endpoint."""

    def __init__(
        self, client: CohereClient, model_name: str, *, dimensions: int | None = None
    ) -> None:
        """Bind a Cohere model and optional v4 output dimension."""
        self._client = client
        self.model_name = model_name
        self.dimensions = dimensions
        self._last_usage: dict[str, int] | None = None

    @property
    def usage(self) -> dict[str, int] | None:
        """Return usage from the most recent Cohere embedding request."""
        return self._last_usage

    def _extract_vectors(self, response: CohereEmbedResponse) -> list[EmbeddingVector]:
        """Read float vectors and normalize Cohere's input-token usage."""
        usage = response.meta.billed_units if response.meta else None
        if usage and usage.input_tokens is not None:
            self._last_usage = {
                "prompt_tokens": usage.input_tokens,
                "total_tokens": usage.input_tokens,
            }
        return [[float(value) for value in vector] for vector in response.embeddings.values]

    def embed_documents(self, chunks: Sequence[DocumentChunk]) -> Sequence[EmbeddingVector]:
        """Embed chunks as searchable documents."""
        if not chunks:
            return []
        response = self._client.embed(
            [chunk.text for chunk in chunks],
            model=self.model_name,
            input_type="search_document",
            output_dimension=self.dimensions,
        )
        vectors = self._extract_vectors(response)
        if len(vectors) != len(chunks):
            raise ValueError("Cohere returned a mismatched number of embeddings.")
        return vectors

    def embed_query(self, query: str) -> EmbeddingVector:
        """Embed a query with Cohere's retrieval-query input type."""
        response = self._client.embed(
            [query],
            model=self.model_name,
            input_type="search_query",
            output_dimension=self.dimensions,
        )
        vectors = self._extract_vectors(response)
        if not vectors:
            raise ValueError("Cohere returned no embedding for the query.")
        return vectors[0]
