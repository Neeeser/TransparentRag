from __future__ import annotations

from pathlib import Path

from pypdf import PdfReader

from ..models import Document
from .base import DocumentParser, DocumentSource


class PdfToTextParser(DocumentParser):
    """Extract native text content from PDF documents."""

    def parse(self, source: DocumentSource) -> Document:
        path = Path(source.path)
        if not path.exists():
            raise FileNotFoundError(f"PDF file not found: {path}")

        reader = PdfReader(str(path))
        text_fragments: list[str] = []
        for page in reader.pages:
            page_text = page.extract_text() or ""
            if page_text.strip():
                text_fragments.append(page_text.strip())

        text = "\n\n".join(text_fragments)
        metadata = source.metadata.model_copy(deep=True)
        return Document(
            document_id=source.document_id,
            text=text,
            metadata=metadata,
        )

