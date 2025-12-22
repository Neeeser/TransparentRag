"""Pipeline nodes for document ingestion."""

# pylint: disable=duplicate-code

from __future__ import annotations

import logging
from pathlib import Path
from typing import Literal, Optional

from pydantic import BaseModel, Field

from app.db.models import ChunkStrategy
from app.pipelines.payloads import (
    ChunkPayload,
    EmbeddingPayload,
    IndexingPayload,
    ParsedDocumentPayload,
    SourcePayload,
)
from app.pipelines.runtime import NodePort, PipelineNodeBase, PipelineRunContext
from app.retrieval.embedders.openrouter_embedder import OpenRouterEmbedder
from app.retrieval.indexers.pinecone_indexer import PineconeIndexConfig, PineconeIndexer
from app.retrieval.models import DocumentMetadata
from app.retrieval.parsers.base import DocumentParser, DocumentSource
from app.retrieval.parsers.pdf import PdfToTextParser
from app.retrieval.parsers.txt import TxtDocumentParser
from app.services.chunking import build_chunker

logger = logging.getLogger(__name__)


class IngestionInputConfig(BaseModel):
    """Configuration for ingestion input nodes."""


class IngestionInputNode(PipelineNodeBase):
    """Load a document source from the current ingestion context."""

    type = "ingestion.input"
    label = "Ingestion Input"
    category = "ingestion"
    description = "Build a document source from the uploaded file."
    example = (
        "Context(document='file.pdf') -> "
        "SourcePayload(document_id='123', path='/tmp/file.pdf', "
        "content_type='application/pdf')."
    )
    input_ports = []
    output_ports = [NodePort(key="source", label="Source", data_type="document_source")]
    config_model = IngestionInputConfig

    def run(self, inputs: dict[str, object], context: PipelineRunContext) -> dict[str, object]:
        """Return the DocumentSource for the ingestion run."""
        if context.document is None:
            raise ValueError("Ingestion context is missing a document record.")
        if not context.document.source_path:
            raise ValueError("Document source path is not set for ingestion.")
        metadata = DocumentMetadata(
            data={
                "collection_id": str(context.collection.id),
                "document_id": str(context.document.id),
                "filename": context.document.name,
            }
        )
        source = DocumentSource(
            document_id=str(context.document.id),
            path=Path(context.document.source_path),
            content_type=context.document.content_type,
            metadata=metadata,
        )
        return {"source": SourcePayload(source=source)}


class ParserConfig(BaseModel):
    """Configuration for document parsing."""

    mode: Literal["auto", "pdf", "text"] = "auto"
    encoding: str = "utf-8"


class DocumentParserNode(PipelineNodeBase):
    """Parse uploaded documents into normalized text."""

    type = "parser.document"
    label = "Document Parser"
    category = "ingestion"
    description = "Extract text from a document source."
    example = (
        "SourcePayload(content_type='application/pdf') -> "
        "ParsedDocumentPayload(text='Invoice #42 ...')."
    )
    input_ports = [NodePort(key="source", label="Source", data_type="document_source")]
    output_ports = [NodePort(key="document", label="Document", data_type="document")]
    config_model = ParserConfig

    def run(self, inputs: dict[str, object], context: PipelineRunContext) -> dict[str, object]:
        """Parse a source payload into a document."""
        payload = SourcePayload.model_validate(inputs.get("source"))
        source = payload.source

        parser = self._resolve_parser(source.content_type)
        logger.info(
            "Pipeline parser=%s document_id=%s content_type=%s",
            parser.__class__.__name__,
            source.document_id,
            source.content_type,
        )
        document = parser.parse(source)
        return {"document": ParsedDocumentPayload(document=document)}

    def _resolve_parser(self, content_type: Optional[str]) -> DocumentParser:
        """Select a parser based on configuration and content type."""
        if self.config.mode == "pdf":
            return PdfToTextParser()
        if self.config.mode == "text":
            return TxtDocumentParser(encoding=self.config.encoding)
        if content_type and "pdf" in content_type:
            return PdfToTextParser()
        return TxtDocumentParser(encoding=self.config.encoding)


class FileTypeRouterConfig(BaseModel):
    """Configuration for file type routing."""

    pdf_label: str = "pdf"
    text_label: str = "text"
    other_label: str = "other"


class FileTypeRouterNode(PipelineNodeBase):
    """Route sources based on content type."""

    type = "router.file_type"
    label = "File Type Router"
    category = "ingestion"
    description = "Branch the pipeline based on the file content type."
    example = (
        "SourcePayload(content_type='application/pdf') -> "
        "{pdf: SourcePayload(...)}."
    )
    input_ports = [NodePort(key="source", label="Source", data_type="document_source")]
    output_ports = [
        NodePort(key="pdf", label="PDF", data_type="document_source", required=False),
        NodePort(key="text", label="Text", data_type="document_source", required=False),
        NodePort(key="other", label="Other", data_type="document_source", required=False),
    ]
    config_model = FileTypeRouterConfig

    def run(self, inputs: dict[str, object], context: PipelineRunContext) -> dict[str, object]:
        """Return the source on the appropriate output port."""
        payload = SourcePayload.model_validate(inputs.get("source"))
        source = payload.source
        content_type = (source.content_type or "").lower()
        if "pdf" in content_type:
            return {"pdf": payload}
        if "text" in content_type or "plain" in content_type:
            return {"text": payload}
        return {"other": payload}


class ChunkerConfig(BaseModel):
    """Configuration for chunking documents."""

    use_collection_defaults: bool = True
    strategy: Optional[ChunkStrategy] = None
    chunk_size: Optional[int] = Field(default=None, gt=0)
    chunk_overlap: Optional[int] = Field(default=None, ge=0)


class ChunkerNode(PipelineNodeBase):
    """Split documents into smaller chunks."""

    type = "chunker.collection"
    label = "Chunker"
    category = "ingestion"
    description = "Chunk documents using collection defaults or overrides."
    example = (
        "ParsedDocumentPayload(text='Hello world') -> "
        "ChunkPayload(chunks=['Hello', 'world'])."
    )
    input_ports = [NodePort(key="document", label="Document", data_type="document")]
    output_ports = [NodePort(key="chunks", label="Chunks", data_type="chunk_batch")]
    config_model = ChunkerConfig

    def run(self, inputs: dict[str, object], context: PipelineRunContext) -> dict[str, object]:
        """Chunk a parsed document into segments."""
        payload = ParsedDocumentPayload.model_validate(inputs.get("document"))
        document = payload.document

        collection = context.collection
        if self.config.use_collection_defaults:
            strategy = self.config.strategy or collection.chunk_strategy
            chunk_size = self.config.chunk_size or collection.chunk_size
            chunk_overlap = self.config.chunk_overlap or collection.chunk_overlap
        else:
            if self.config.strategy is None:
                raise ValueError("Chunker strategy must be set when defaults are disabled.")
            if self.config.chunk_size is None:
                raise ValueError("Chunker size must be set when defaults are disabled.")
            if self.config.chunk_overlap is None:
                raise ValueError("Chunker overlap must be set when defaults are disabled.")
            strategy = self.config.strategy
            chunk_size = self.config.chunk_size
            chunk_overlap = self.config.chunk_overlap

        chunker = build_chunker(strategy, chunk_size, chunk_overlap)
        chunks = list(chunker.chunk(document))
        logger.info(
            "Pipeline chunker=%s produced %s chunks for document %s",
            chunker.__class__.__name__,
            len(chunks),
            document.document_id,
        )
        return {"chunks": ChunkPayload(document=document, chunks=chunks)}


class EmbedderConfig(BaseModel):
    """Configuration for embedding nodes."""

    use_collection_defaults: bool = True
    model_name: Optional[str] = None


class EmbedderNode(PipelineNodeBase):
    """Generate embeddings for document chunks."""

    type = "embedder.openrouter"
    label = "Embedder"
    category = "ingestion"
    description = "Embed chunks using OpenRouter."
    example = (
        "ChunkPayload(chunks=['hello']) -> "
        "EmbeddingPayload(embeddings=[[0.12, 0.03, ...]])."
    )
    input_ports = [NodePort(key="chunks", label="Chunks", data_type="chunk_batch")]
    output_ports = [NodePort(key="embedded", label="Embedded", data_type="embedded_batch")]
    config_model = EmbedderConfig

    def run(self, inputs: dict[str, object], context: PipelineRunContext) -> dict[str, object]:
        """Embed chunk payloads with OpenRouter."""
        payload = ChunkPayload.model_validate(inputs.get("chunks"))
        document = payload.document
        chunks = payload.chunks

        model_name = (
            context.collection.embedding_model
            if self.config.use_collection_defaults or not self.config.model_name
            else self.config.model_name
        )
        embedder = OpenRouterEmbedder(context.openrouter, model_name)
        embeddings = embedder.embed_documents(chunks)
        if len(embeddings) != len(chunks):
            raise ValueError("Embedder returned mismatched embeddings.")
        enriched_chunks = [
            chunk.with_embedding(embedding)
            for chunk, embedding in zip(chunks, embeddings)
        ]
        usage = embedder.usage or {}
        return {
            "embedded": EmbeddingPayload(
                document=document,
                chunks=enriched_chunks,
                usage=usage,
            )
        }


class IndexerConfig(BaseModel):
    """Configuration for indexing nodes."""

    use_collection_defaults: bool = True
    index_name: Optional[str] = None
    namespace: Optional[str] = None
    dimension: Optional[int] = None
    metric: str = "cosine"
    ensure_index: bool = True


class IndexerNode(PipelineNodeBase):
    """Upsert embedded chunks into Pinecone."""

    type = "indexer.pinecone"
    label = "Indexer"
    category = "ingestion"
    description = "Upsert embeddings into Pinecone."
    example = (
        "EmbeddingPayload(chunks=2) -> "
        "IndexingPayload(chunks=2, index='pinecone')."
    )
    input_ports = [NodePort(key="embedded", label="Embedded", data_type="embedded_batch")]
    output_ports = [NodePort(key="indexed", label="Indexed", data_type="indexed_batch")]
    config_model = IndexerConfig

    def run(self, inputs: dict[str, object], context: PipelineRunContext) -> dict[str, object]:
        """Upsert embedded chunks into Pinecone."""
        payload = EmbeddingPayload.model_validate(inputs.get("embedded"))
        document = payload.document
        chunks = payload.chunks

        collection = context.collection
        if self.config.use_collection_defaults:
            index_name = self.config.index_name or collection.pinecone_index
            namespace = self.config.namespace or collection.pinecone_namespace
            dimension = self.config.dimension or collection.extra_metadata.get(
                "embedding_dimension",
                1536,
            )
        else:
            if not self.config.index_name:
                raise ValueError("Indexer name must be set when defaults are disabled.")
            if not self.config.namespace:
                raise ValueError("Indexer namespace must be set when defaults are disabled.")
            if self.config.dimension is None:
                raise ValueError("Indexer dimension must be set when defaults are disabled.")
            index_name = self.config.index_name
            namespace = self.config.namespace
            dimension = self.config.dimension

        index_config = PineconeIndexConfig(
            name=index_name,
            namespace=namespace,
            dimension=int(dimension),
            metric=self.config.metric,
        )
        indexer = PineconeIndexer(client=context.pinecone)
        if self.config.ensure_index:
            indexer.ensure_index(index_config)
        indexer.upsert(config=index_config, chunks=chunks, namespace=namespace)
        return {
            "indexed": IndexingPayload(
                document=document,
                chunks=chunks,
                usage=payload.usage,
            )
        }


class IngestionOutputConfig(BaseModel):
    """Configuration for ingestion output nodes."""


class IngestionOutputNode(PipelineNodeBase):
    """Terminal node for ingestion pipelines."""

    type = "ingestion.output"
    label = "Ingestion Output"
    category = "ingestion"
    description = "Emit the indexed chunks for persistence."
    example = (
        "IndexingPayload(chunks=2) -> "
        "Result(IndexingPayload(chunks=2))."
    )
    input_ports = [NodePort(key="indexed", label="Indexed", data_type="indexed_batch")]
    output_ports = [NodePort(key="result", label="Result", data_type="indexed_batch")]
    config_model = IngestionOutputConfig

    def run(self, inputs: dict[str, object], context: PipelineRunContext) -> dict[str, object]:
        """Pass through indexed payloads."""
        payload = IndexingPayload.model_validate(inputs.get("indexed"))
        return {"result": payload}
