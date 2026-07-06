"""Rerankers for post-processing retrieval results."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from .base import Reranker

__all__ = ["CrossEncoderReranker", "Reranker"]

if TYPE_CHECKING:
    from .cross_encoder import CrossEncoderReranker


def __getattr__(name: str) -> Any:
    """Lazily expose optional reranker implementations."""
    if name == "CrossEncoderReranker":
        from .cross_encoder import CrossEncoderReranker  # pylint: disable=import-outside-toplevel

        return CrossEncoderReranker
    raise AttributeError(f"module {__name__} has no attribute {name!r}")
