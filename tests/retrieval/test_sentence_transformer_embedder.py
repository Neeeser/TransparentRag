from __future__ import annotations

from typing import Any, List

from app.retrieval.embedders import sentence_transformer as embedder_module
from app.retrieval.embedders.sentence_transformer import SentenceTransformerEmbedder
from app.retrieval.models import DocumentChunk, DocumentMetadata


class _FakeArray:
    def __init__(self, values: List[float]) -> None:
        self._values = list(values)

    def astype(self, _dtype: Any) -> "_FakeArray":
        return self

    def tolist(self) -> List[float]:
        return list(self._values)


class _StubSentenceTransformer:
    def __init__(self) -> None:
        self.calls: list[dict[str, Any]] = []

    def encode(
        self,
        texts: Any,
        *,
        convert_to_numpy: bool,
        normalize_embeddings: bool,
        show_progress_bar: bool,
    ) -> Any:
        self.calls.append(
            {
                "texts": texts,
                "convert_to_numpy": convert_to_numpy,
                "normalize_embeddings": normalize_embeddings,
                "show_progress_bar": show_progress_bar,
            }
        )
        if isinstance(texts, list):
            return [_FakeArray([1.0, 2.0]) for _ in texts]
        return _FakeArray([0.5, 0.25])


def _chunk(text: str, chunk_id: str) -> DocumentChunk:
    return DocumentChunk(
        document_id="doc-1",
        chunk_id=chunk_id,
        text=text,
        order=int(chunk_id.split("-")[-1]),
        metadata=DocumentMetadata(),
    )


def test_sentence_transformer_embedder_encodes_documents_and_query(monkeypatch) -> None:
    stub_model = _StubSentenceTransformer()

    def _factory(model_name: str, **_kwargs: Any) -> _StubSentenceTransformer:
        return stub_model

    monkeypatch.setattr(embedder_module, "SentenceTransformer", _factory)

    embedder = SentenceTransformerEmbedder(model_name="unit-test", normalize_embeddings=False)
    chunks = [_chunk("hello", "chunk-0"), _chunk("world", "chunk-1")]

    vectors = embedder.embed_documents(chunks)
    query_vector = embedder.embed_query("query")

    assert vectors == [[1.0, 2.0], [1.0, 2.0]]
    assert query_vector == [0.5, 0.25]
    assert stub_model.calls[0]["texts"] == ["hello", "world"]
    assert stub_model.calls[1]["texts"] == "query"


def test_sentence_transformer_embedder_handles_empty_chunks(monkeypatch) -> None:
    def _factory(model_name: str, **_kwargs: Any) -> _StubSentenceTransformer:
        return _StubSentenceTransformer()

    monkeypatch.setattr(embedder_module, "SentenceTransformer", _factory)

    embedder = SentenceTransformerEmbedder(model_name="unit-test")

    assert embedder.embed_documents([]) == []
