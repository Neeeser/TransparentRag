"""Provider-key validation behavior (migrated from the auth route tests).

Each validator makes one authenticated provider call; these stub the client at
the ``provider_keys`` boundary and assert the resulting ``ProviderKeyStatus``.
"""

from __future__ import annotations

import httpx

from app.db import models
from app.services import provider_keys


class _StubOpenRouter:
    def __init__(self, error: Exception | None = None) -> None:
        self._error = error

    def get_current_key(self):
        if self._error:
            raise self._error
        return {"data": {"label": "valid"}}


class _StubPinecone:
    def __init__(self, error: Exception | None = None) -> None:
        self._error = error

    def list_indexes(self):
        if self._error:
            raise self._error
        return []


def _http_status_error(code: int) -> httpx.HTTPStatusError:
    request = httpx.Request("GET", "https://openrouter.ai/api/v1/key")
    response = httpx.Response(code, request=request)
    return httpx.HTTPStatusError("boom", request=request, response=response)


def test_validate_openrouter_key_missing() -> None:
    status = provider_keys.validate_openrouter_key("  ")
    assert status == provider_keys.ProviderKeyStatus(
        configured=False, valid=False, message="Missing."
    )


def test_validate_openrouter_key_connected(monkeypatch) -> None:
    monkeypatch.setattr(provider_keys, "get_openrouter_client", lambda *_a, **_k: _StubOpenRouter())
    status = provider_keys.validate_openrouter_key("key")
    assert status.valid is True
    assert status.message == "Connected."


def test_validate_openrouter_key_invalid_credentials(monkeypatch) -> None:
    monkeypatch.setattr(
        provider_keys,
        "get_openrouter_client",
        lambda *_a, **_k: _StubOpenRouter(_http_status_error(401)),
    )
    status = provider_keys.validate_openrouter_key("bad")
    assert status.valid is False
    assert status.message == "Invalid OpenRouter API key."


def test_validate_openrouter_key_server_error(monkeypatch) -> None:
    monkeypatch.setattr(
        provider_keys,
        "get_openrouter_client",
        lambda *_a, **_k: _StubOpenRouter(_http_status_error(500)),
    )
    status = provider_keys.validate_openrouter_key("bad")
    assert status.valid is False
    assert status.message == "OpenRouter validation failed."


def test_validate_openrouter_key_network_error(monkeypatch) -> None:
    monkeypatch.setattr(
        provider_keys,
        "get_openrouter_client",
        lambda *_a, **_k: _StubOpenRouter(httpx.HTTPError("network")),
    )
    status = provider_keys.validate_openrouter_key("bad")
    assert status.valid is False
    assert status.message == "OpenRouter validation failed."


def test_validate_pinecone_key_invalid(monkeypatch) -> None:
    monkeypatch.setattr(
        provider_keys,
        "get_pinecone_client",
        lambda *_a, **_k: _StubPinecone(provider_keys.PineconeException("bad")),
    )
    status = provider_keys.validate_pinecone_key("bad")
    assert status.valid is False
    assert status.message == "Invalid Pinecone API key."


def test_validate_pinecone_key_connected(monkeypatch) -> None:
    monkeypatch.setattr(provider_keys, "get_pinecone_client", lambda *_a, **_k: _StubPinecone())
    status = provider_keys.validate_pinecone_key("key")
    assert status.valid is True


def test_validate_key_dispatches_per_provider(monkeypatch) -> None:
    monkeypatch.setattr(provider_keys, "get_openrouter_client", lambda *_a, **_k: _StubOpenRouter())
    monkeypatch.setattr(provider_keys, "get_pinecone_client", lambda *_a, **_k: _StubPinecone())

    assert provider_keys.validate_key(provider_keys.Provider.OPENROUTER, "key").valid is True
    assert provider_keys.validate_key(provider_keys.Provider.PINECONE, "key").valid is True


def test_validate_user_keys_reports_missing() -> None:
    user = models.User(email="u@example.com", full_name="U", hashed_password="hashed")
    result = provider_keys.validate_user_keys(user)
    assert result.openrouter.configured is False
    assert result.pinecone.configured is False


def test_validate_user_keys_reports_connected(monkeypatch) -> None:
    monkeypatch.setattr(provider_keys, "get_openrouter_client", lambda *_a, **_k: _StubOpenRouter())
    monkeypatch.setattr(provider_keys, "get_pinecone_client", lambda *_a, **_k: _StubPinecone())
    user = models.User(
        email="u@example.com",
        full_name="U",
        hashed_password="hashed",
        openrouter_api_key="openrouter-key",
        pinecone_api_key="pinecone-key",
    )

    result = provider_keys.validate_user_keys(user)

    assert result.openrouter.valid is True
    assert result.pinecone.valid is True
