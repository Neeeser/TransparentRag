"""Embedder implementations for vectorization."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from .base import Embedder

__all__ = ["Embedder", "SentenceTransformerEmbedder"]

if TYPE_CHECKING:
    from .sentence_transformer import SentenceTransformerEmbedder


def __getattr__(name: str) -> Any:
    """Lazily expose optional embedder implementations."""
    if name == "SentenceTransformerEmbedder":
        from .sentence_transformer import (  # pylint: disable=import-outside-toplevel
            SentenceTransformerEmbedder,
        )

        return SentenceTransformerEmbedder
    raise AttributeError(f"module {__name__} has no attribute {name!r}")
