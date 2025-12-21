"""Shared helpers for Pinecone client initialization."""

from __future__ import annotations

import os
from typing import Optional

from pinecone import Pinecone


def get_pinecone_client(
    client: Optional[Pinecone] = None,
    api_key: Optional[str] = None,
) -> Pinecone:
    """Return a configured Pinecone client instance."""
    resolved_api_key = api_key or os.getenv("PINECONE_API_KEY")
    if client is None:
        if not resolved_api_key:
            raise ValueError(
                "Pinecone API key must be provided via argument or PINECONE_API_KEY env var."
            )
        client = Pinecone(api_key=resolved_api_key)
    return client
