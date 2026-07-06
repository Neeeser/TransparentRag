"""Sentence-transformer embedder implementation."""

from __future__ import annotations

from collections.abc import Sequence

from sentence_transformers import SentenceTransformer

from ..models import DocumentChunk, EmbeddingVector
from .base import Embedder


class SentenceTransformerEmbedder(Embedder):
    """SentenceTransformer-based embedder."""

    def __init__(
        self,
        model_name: str = "sentence-transformers/all-MiniLM-L6-v2",
        normalize_embeddings: bool = True,
        **model_kwargs: object,
    ) -> None:
        """Initialize the transformer model for embeddings."""
        self.model_name = model_name
        self._normalize = normalize_embeddings
        # `**model_kwargs` deliberately accepts any SentenceTransformer constructor
        # kwarg the caller wants to pass through; mypy can't match a dynamic kwargs
        # dict against the SDK's very specific overloaded constructor signature.
        self._model = SentenceTransformer(model_name, **model_kwargs)  # type: ignore[arg-type]

    def embed_documents(self, chunks: Sequence[DocumentChunk]) -> Sequence[EmbeddingVector]:
        """Embed document chunks as vectors."""
        if not chunks:
            return []

        texts = [chunk.text for chunk in chunks]
        embeddings = self._model.encode(
            texts,
            convert_to_numpy=True,
            normalize_embeddings=self._normalize,
            show_progress_bar=False,
        )
        return [embedding.astype(float).tolist() for embedding in embeddings]

    def embed_query(self, query: str) -> EmbeddingVector:
        """Embed a query string as a vector."""
        embedding = self._model.encode(
            query,
            convert_to_numpy=True,
            normalize_embeddings=self._normalize,
            show_progress_bar=False,
        )
        # numpy's `.tolist()` stub returns `Any`; the runtime shape is `list[float]`.
        return embedding.astype(float).tolist()  # type: ignore[no-any-return]
