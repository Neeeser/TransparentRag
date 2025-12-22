"""Pipeline nodes for retrieval workflows."""

# pylint: disable=duplicate-code

from __future__ import annotations

import logging
from typing import Optional

from pydantic import BaseModel

from app.pipelines.payloads import RetrievalPayload, RetrievalRequestPayload
from app.pipelines.runtime import NodePort, PipelineNodeBase, PipelineRunContext
from app.retrieval.embedders.openrouter_embedder import OpenRouterEmbedder
from app.retrieval.indexers.pinecone_indexer import PineconeIndexConfig
from app.retrieval.models import QueryRequest
from app.retrieval.rerankers.cross_encoder import CrossEncoderReranker
from app.retrieval.retrievers.pinecone_retriever import PineconeRetriever

logger = logging.getLogger(__name__)


class RetrievalInputConfig(BaseModel):
    """Configuration for retrieval input nodes."""


class RetrievalInputNode(PipelineNodeBase):
    """Build the query request from the retrieval context."""

    type = "retrieval.input"
    label = "Retrieval Input"
    category = "retrieval"
    description = "Provide the query payload for retrieval."
    example = "Query='coffee', top_k=3 -> QueryRequest(text='coffee', top_k=3)."
    input_ports = []
    output_ports = [NodePort(key="request", label="Request", data_type="query_request")]
    config_model = RetrievalInputConfig

    def run(self, inputs: dict[str, object], context: PipelineRunContext) -> dict[str, object]:
        """Create a QueryRequest from context."""
        if context.query is None:
            raise ValueError("Retrieval context is missing a query string.")
        top_k = context.top_k or 5
        request = QueryRequest(
            text=context.query,
            top_k=top_k,
            namespace=context.collection.pinecone_namespace,
        )
        return {"request": RetrievalRequestPayload(request=request)}


class RetrieverConfig(BaseModel):
    """Configuration for Pinecone retriever nodes."""

    use_collection_defaults: bool = True
    embedding_model: Optional[str] = None
    index_name: Optional[str] = None
    namespace: Optional[str] = None
    dimension: Optional[int] = None
    metric: str = "cosine"


class PineconeRetrieverNode(PipelineNodeBase):
    """Retrieve relevant chunks from Pinecone."""

    type = "retriever.pinecone"
    label = "Pinecone Retriever"
    category = "retrieval"
    description = "Retrieve chunks from Pinecone using embeddings."
    example = (
        "QueryRequest(text='coffee') -> "
        "RetrievalPayload(matches=[chunk_a, chunk_b])."
    )
    input_ports = [NodePort(key="request", label="Request", data_type="query_request")]
    output_ports = [NodePort(key="results", label="Results", data_type="retrieval_results")]
    config_model = RetrieverConfig

    def run(self, inputs: dict[str, object], context: PipelineRunContext) -> dict[str, object]:
        """Retrieve chunks for the query request."""
        payload = RetrievalRequestPayload.model_validate(inputs.get("request"))
        request = payload.request

        collection = context.collection
        if self.config.use_collection_defaults:
            embedding_model = self.config.embedding_model or collection.embedding_model
            index_name = self.config.index_name or collection.pinecone_index
            namespace = self.config.namespace or collection.pinecone_namespace
            dimension = self.config.dimension or collection.extra_metadata.get(
                "embedding_dimension",
                1536,
            )
        else:
            if not self.config.embedding_model:
                raise ValueError("Embedding model must be set when defaults are disabled.")
            if not self.config.index_name:
                raise ValueError("Index name must be set when defaults are disabled.")
            if not self.config.namespace:
                raise ValueError("Namespace must be set when defaults are disabled.")
            if self.config.dimension is None:
                raise ValueError("Dimension must be set when defaults are disabled.")
            embedding_model = self.config.embedding_model
            index_name = self.config.index_name
            namespace = self.config.namespace
            dimension = self.config.dimension

        embedder = OpenRouterEmbedder(context.openrouter, embedding_model)
        index_config = PineconeIndexConfig(
            name=index_name,
            namespace=namespace,
            dimension=int(dimension),
            metric=self.config.metric,
        )
        retriever = PineconeRetriever(
            index_config=index_config,
            embedder=embedder,
            client=context.pinecone,
        )
        response = retriever.retrieve(
            QueryRequest(
                text=request.text,
                top_k=request.top_k,
                namespace=namespace,
                filter=request.filter,
            )
        )
        usage = embedder.usage or {}
        logger.info(
            "Pipeline retrieval returned %s matches for query.",
            len(response.matches),
        )
        return {"results": RetrievalPayload(response=response, usage=usage)}


class RerankerConfig(BaseModel):
    """Configuration for reranking nodes."""

    enabled: bool = False
    model_name: str = "cross-encoder/ms-marco-MiniLM-L-6-v2"


class RerankerNode(PipelineNodeBase):
    """Rerank retrieval results using a cross-encoder."""

    type = "reranker.cross_encoder"
    label = "Cross-Encoder Reranker"
    category = "retrieval"
    description = "Re-score retrieved chunks with a cross-encoder."
    example = (
        "RetrievalPayload([chunk_b, chunk_a]) -> "
        "RetrievalPayload([chunk_a, chunk_b])."
    )
    input_ports = [NodePort(key="results", label="Results", data_type="retrieval_results")]
    output_ports = [NodePort(key="results", label="Results", data_type="retrieval_results")]
    config_model = RerankerConfig

    def run(self, inputs: dict[str, object], context: PipelineRunContext) -> dict[str, object]:
        """Rerank results when enabled."""
        payload = RetrievalPayload.model_validate(inputs.get("results"))
        if not self.config.enabled:
            return {"results": payload}
        if context.query is None:
            raise ValueError("Reranker requires a query string in context.")
        reranker = CrossEncoderReranker(model_name=self.config.model_name)
        top_k = len(payload.response.matches) or None
        reranked = reranker.rerank(
            query=context.query,
            candidates=payload.response.matches,
            top_k=top_k,
        )
        response = payload.response.model_copy(update={"matches": list(reranked)})
        return {"results": RetrievalPayload(response=response, usage=payload.usage)}


class RetrievalOutputConfig(BaseModel):
    """Configuration for retrieval output nodes."""


class RetrievalOutputNode(PipelineNodeBase):
    """Terminal node for retrieval pipelines."""

    type = "retrieval.output"
    label = "Retrieval Output"
    category = "retrieval"
    description = "Emit retrieval results for the API."
    example = (
        "RetrievalPayload(matches=2) -> "
        "Result(RetrievalPayload(matches=2))."
    )
    input_ports = [NodePort(key="results", label="Results", data_type="retrieval_results")]
    output_ports = [NodePort(key="result", label="Result", data_type="retrieval_results")]
    config_model = RetrievalOutputConfig

    def run(self, inputs: dict[str, object], context: PipelineRunContext) -> dict[str, object]:
        """Return the retrieval payload."""
        payload = RetrievalPayload.model_validate(inputs.get("results"))
        return {"result": payload}
