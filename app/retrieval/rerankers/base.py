from __future__ import annotations

from typing import Protocol, Sequence

from ..models import ScoredChunk


class Reranker(Protocol):
    """Protocol describing reranking behaviour."""

    def rerank(
        self,
        query: str,
        candidates: Sequence[ScoredChunk],
        top_k: int | None = None,
    ) -> Sequence[ScoredChunk]:
        ...

