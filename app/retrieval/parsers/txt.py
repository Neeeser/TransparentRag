from __future__ import annotations

from pathlib import Path

from ..models import Document
from .base import DocumentParser, DocumentSource


class TxtDocumentParser(DocumentParser):
    """Parse plain text files into Document instances."""

    def __init__(self, encoding: str = "utf-8") -> None:
        self._encoding = encoding

    def parse(self, source: DocumentSource) -> Document:
        path = Path(source.path)
        if not path.exists():
            raise FileNotFoundError(f"Text file not found: {path}")

        text = path.read_text(encoding=self._encoding)
        metadata = source.metadata.model_copy(deep=True)
        return Document(
            document_id=source.document_id,
            text=text,
            metadata=metadata,
        )

