"""Behavior tests for the Cohere retrieval embedder."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


def _chunks(*texts: str):
    """Build document chunks for embedding tests."""
    from app.retrieval.models import DocumentChunk

    return [
        DocumentChunk(chunk_id=f"doc:{index}", document_id="doc", order=index, text=text)
        for index, text in enumerate(texts)
    ]


def test_embedder_uses_document_and_query_input_types_with_dimension() -> None:
    """Documents and queries use the retrieval modes Cohere requires."""
    from app.clients.cohere.schemas import CohereEmbedResponse
    from app.retrieval.embedders.cohere_embedder import CohereEmbedder

    @dataclass
    class Client:
        calls: list[dict[str, Any]] = field(default_factory=list)

        def embed(self, texts: list[str], **kwargs: Any) -> CohereEmbedResponse:
            self.calls.append({"texts": texts, **kwargs})
            return CohereEmbedResponse.model_validate(
                {"embeddings": {"float": [[0.1, 0.2] for _ in texts]}}
            )

    client = Client()
    embedder = CohereEmbedder(client, "embed-v4.0", dimensions=1024)

    assert embedder.embed_documents(_chunks("one", "two")) == [[0.1, 0.2], [0.1, 0.2]]
    assert embedder.embed_query("question") == [0.1, 0.2]
    assert client.calls == [
        {"texts": ["one", "two"], "model": "embed-v4.0", "input_type": "search_document", "output_dimension": 1024},
        {"texts": ["question"], "model": "embed-v4.0", "input_type": "search_query", "output_dimension": 1024},
    ]
