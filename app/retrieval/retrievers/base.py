from __future__ import annotations

from typing import Protocol

from ..models import QueryRequest, RetrievalResponse


class Retriever(Protocol):
    """Protocol describing read access to a vector index."""

    def retrieve(self, request: QueryRequest) -> RetrievalResponse:
        ...

