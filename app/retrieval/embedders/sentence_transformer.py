from __future__ import annotations

from typing import Sequence

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
        self.model_name = model_name
        self._normalize = normalize_embeddings
        self._model = SentenceTransformer(model_name, **model_kwargs)

    def embed_documents(self, chunks: Sequence[DocumentChunk]) -> Sequence[EmbeddingVector]:
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
        embedding = self._model.encode(
            query,
            convert_to_numpy=True,
            normalize_embeddings=self._normalize,
            show_progress_bar=False,
        )
        return embedding.astype(float).tolist()

