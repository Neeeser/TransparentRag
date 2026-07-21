"""Behavior tests for the TEI embedding adapter."""

from __future__ import annotations

from dataclasses import dataclass, field

import pytest

from app.retrieval.embedders.tei_embedder import TEIEmbedder
from app.retrieval.models import DocumentChunk


@dataclass
class _TEIClient:
    response: list[list[float]]
    served_model: str | None = None
    calls: list[list[str]] = field(default_factory=list)

    def ensure_serves(self, model_name: str) -> None:
        if self.served_model is not None and self.served_model != model_name:
            raise ValueError(
                f"The TEI server now serves '{self.served_model}', not '{model_name}'."
            )

    def embed(self, texts: list[str]) -> list[list[float]]:
        self.calls.append(texts)
        return self.response


def _chunks(*texts: str) -> list[DocumentChunk]:
    return [
        DocumentChunk(document_id="doc", chunk_id=f"chunk-{index}", text=text, order=index)
        for index, text in enumerate(texts)
    ]


def test_embed_documents_preserves_teis_vector_shape_without_usage() -> None:
    client = _TEIClient([[0.1, 0.2], [0.3, 0.4]])
    embedder = TEIEmbedder(client, "BAAI/bge-base-en-v1.5")  # type: ignore[arg-type]

    assert embedder.embed_documents(_chunks("alpha", "beta")) == [
        [0.1, 0.2],
        [0.3, 0.4],
    ]
    assert client.calls == [["alpha", "beta"]]
    assert embedder.usage is None


def test_embed_documents_rejects_mismatched_vector_count() -> None:
    embedder = TEIEmbedder(_TEIClient([[0.1]]), "BAAI/bge-base-en-v1.5")  # type: ignore[arg-type]

    with pytest.raises(ValueError, match="mismatched"):
        embedder.embed_documents(_chunks("alpha", "beta"))


def test_embed_query_returns_the_servers_first_vector() -> None:
    embedder = TEIEmbedder(_TEIClient([[0.5, 0.6]]), "BAAI/bge-base-en-v1.5")  # type: ignore[arg-type]

    assert embedder.embed_query("hello") == [0.5, 0.6]


def test_embed_query_rejects_a_missing_vector() -> None:
    embedder = TEIEmbedder(_TEIClient([]), "BAAI/bge-base-en-v1.5")  # type: ignore[arg-type]

    with pytest.raises(ValueError, match="exactly one"):
        embedder.embed_query("hello")


def test_embedding_aborts_before_sending_inputs_when_served_model_changed() -> None:
    """A TEI restart with a different --model-id mid-ingest must not index vectors.

    Regression: the served model was validated only when the embedder was
    constructed, so a container swapped between validation and inference
    silently indexed wrong-model vectors.
    """
    client = _TEIClient([[0.1, 0.2]], served_model="BAAI/bge-large-en-v1.5")
    embedder = TEIEmbedder(client, "BAAI/bge-base-en-v1.5")  # type: ignore[arg-type]

    with pytest.raises(ValueError, match="now serves"):
        embedder.embed_documents(_chunks("alpha"))
    with pytest.raises(ValueError, match="now serves"):
        embedder.embed_query("hello")
    assert client.calls == []


def test_embed_query_rejects_multiple_vectors() -> None:
    client = _TEIClient([[0.5, 0.6], [0.7, 0.8]])
    embedder = TEIEmbedder(client, "BAAI/bge-base-en-v1.5")  # type: ignore[arg-type]

    with pytest.raises(ValueError, match="exactly one"):
        embedder.embed_query("hello")
