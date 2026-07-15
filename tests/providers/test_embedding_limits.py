"""Provider-neutral embedding input-limit resolution."""

from __future__ import annotations

from typing import TypeVar
from uuid import uuid4

import pytest

from app.cache import CacheSnapshot
from app.clients.ollama.errors import OllamaApiError
from app.db import models
from app.providers import base as provider_base
from app.providers.ollama import OllamaAdapter
from app.providers.openrouter import OpenRouterAdapter
from app.providers.pinecone import PineconeAdapter
from app.schemas.enums import ProviderKind
from app.schemas.models import EmbeddingModelInfo
from app.schemas.ollama import OllamaModelDescription
from app.services.errors import InvalidInputError

ValueT = TypeVar("ValueT")


def _snapshot(value: ValueT) -> CacheSnapshot[ValueT]:
    return CacheSnapshot(
        value=value,
        freshness="fresh",
        age_seconds=0,
        refreshing=False,
        warning=None,
    )


def test_openrouter_embedding_input_limit_reads_cached_resolved_metadata(
    monkeypatch,
) -> None:
    connection = models.ProviderConnection(
        user_id=uuid4(),
        provider_type="openrouter",
        label="OpenRouter",
        config={"api_key": "test-key"},
    )
    adapter = OpenRouterAdapter(connection)

    class _Client:
        @staticmethod
        def list_embedding_model_metadata():
            return _snapshot(
                [
                    EmbeddingModelInfo(
                        id="sentence-transformers/all-minilm-l6-v2",
                        name="all-MiniLM-L6-v2",
                        context_length=8192,
                        max_input_tokens=512,
                    )
                ]
            )

    monkeypatch.setattr(adapter, "_client", lambda: _Client())

    assert adapter.embedding_input_limit("SENTENCE-TRANSFORMERS/ALL-MINILM-L6-V2") == 512
    assert adapter.embedding_input_limit("missing/model") is None


def test_ollama_embedding_input_limit_uses_show_metadata_without_embed_probe(
    monkeypatch,
) -> None:
    connection = models.ProviderConnection(
        user_id=uuid4(),
        provider_type="ollama",
        label="Ollama",
        config={"base_url": "http://ollama.test:11434"},
    )
    adapter = OllamaAdapter(connection)

    class _Client:
        @staticmethod
        def describe_models():
            return _snapshot(
                [
                    OllamaModelDescription(
                        name="nomic-embed-text:latest",
                        capabilities=["embedding"],
                        context_length=2048,
                    )
                ]
            )

        @staticmethod
        def embed(*_args, **_kwargs):
            raise AssertionError("limit lookup must not probe /api/embed")

    monkeypatch.setattr(adapter, "_client", lambda: _Client())

    assert adapter.embedding_input_limit("nomic-embed-text:latest") == 2048
    assert adapter.embedding_input_limit("missing:model") is None


def test_openrouter_embedding_input_limit_propagates_catalog_provider_errors(
    monkeypatch,
) -> None:
    connection = models.ProviderConnection(
        user_id=uuid4(),
        provider_type="openrouter",
        label="OpenRouter",
        config={"api_key": "test-key"},
    )
    adapter = OpenRouterAdapter(connection)

    class _Client:
        @staticmethod
        def list_embedding_model_metadata():
            raise RuntimeError("catalog unavailable")

    monkeypatch.setattr(adapter, "_client", lambda: _Client())

    with pytest.raises(RuntimeError, match="catalog unavailable"):
        adapter.embedding_input_limit("model")


def test_ollama_embedding_input_limit_propagates_show_provider_errors(monkeypatch) -> None:
    connection = models.ProviderConnection(
        user_id=uuid4(),
        provider_type="ollama",
        label="Ollama",
        config={"base_url": "http://ollama.test:11434"},
    )
    adapter = OllamaAdapter(connection)

    class _Client:
        @staticmethod
        def describe_models():
            raise OllamaApiError("show failed", status_code=401)

    monkeypatch.setattr(adapter, "_client", lambda: _Client())

    with pytest.raises(OllamaApiError, match="show failed"):
        adapter.embedding_input_limit("nomic-embed-text:latest")


def test_provider_base_contract_rejects_model_operations_for_vector_store() -> None:
    connection = models.ProviderConnection(
        user_id=uuid4(),
        provider_type="pinecone",
        label="Pinecone",
        config={"api_key": "test-key"},
    )
    adapter = PineconeAdapter(connection)

    assert adapter.list_models(ProviderKind.VECTOR_STORE).models == []
    with pytest.raises(InvalidInputError, match="do not provide embedding models"):
        adapter.list_models(ProviderKind.EMBEDDING)
    with pytest.raises(InvalidInputError, match="do not provide embedding models"):
        adapter.embedder("model")
    with pytest.raises(InvalidInputError, match="do not provide chat models"):
        adapter.chat_provider()
    with pytest.raises(InvalidInputError, match="do not provide embedding models"):
        adapter.embedding_dimension("model")
    with pytest.raises(InvalidInputError, match="do not provide embedding models"):
        adapter.embedding_input_limit("model")


def test_effective_embedding_input_limit_reserves_named_margin() -> None:
    assert getattr(provider_base, "EMBEDDING_INPUT_MARGIN_TOKENS", None) == 16
    effective_limit = getattr(provider_base, "effective_embedding_input_limit", None)
    assert effective_limit is not None
    assert effective_limit(512) == 496
