"""Protocols for retrieval backends."""

from __future__ import annotations

from typing import Protocol

from ..models import QueryRequest, RetrievalResponse


class Retriever(Protocol):  # pylint: disable=too-few-public-methods
    """Protocol describing read access to a vector index."""

    def retrieve(self, request: QueryRequest) -> RetrievalResponse:
        """Return retrieval results for the query request."""
        return None
