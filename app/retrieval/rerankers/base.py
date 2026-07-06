"""Protocols for reranker implementations."""

from __future__ import annotations

from collections.abc import Sequence
from typing import Protocol

from ..models import ScoredChunk


class Reranker(Protocol):  # pylint: disable=too-few-public-methods
    """Protocol describing reranking behaviour."""

    def rerank(
        self,
        query: str,
        candidates: Sequence[ScoredChunk],
        top_k: int | None = None,
    ) -> Sequence[ScoredChunk]:
        """Return reranked chunks for the query."""
        ...
