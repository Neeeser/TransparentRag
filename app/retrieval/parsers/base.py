from __future__ import annotations

from pathlib import Path
from typing import Optional, Protocol

from pydantic import BaseModel, Field

from ..models import Document, DocumentMetadata


class DocumentSource(BaseModel):
    """Represents a raw document asset ready for parsing."""

    document_id: str
    path: Path
    content_type: Optional[str] = None
    metadata: DocumentMetadata = Field(default_factory=DocumentMetadata)


class DocumentParser(Protocol):
    """Protocol describing how to turn a raw document into indexable text."""

    def parse(self, source: DocumentSource) -> Document:
        ...

