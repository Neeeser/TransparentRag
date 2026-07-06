"""Shared helpers for Pinecone client initialization."""

from __future__ import annotations

from pinecone import Pinecone


def get_pinecone_client(
    client: Pinecone | None = None,
    api_key: str | None = None,
) -> Pinecone:
    """Return a configured Pinecone client instance.

    NOTE: `app.clients.pinecone.get_pinecone_client(api_key)` is a same-named factory
    with a different signature (no client-injection parameter). This DI-style resolver
    and its remaining callers consolidate onto that one in Phase 6 (retrieval refactor).
    """
    if client is None:
        resolved_api_key = (api_key or "").strip()
        if not resolved_api_key:
            raise ValueError("Pinecone API key must be provided.")
        client = Pinecone(api_key=resolved_api_key)
    return client
