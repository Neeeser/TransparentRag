"""Chunkers for document ingestion."""

from .base import DocumentChunker
from .text import FixedSizeTextChunker

__all__ = ["DocumentChunker", "FixedSizeTextChunker"]
