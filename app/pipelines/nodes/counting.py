"""Counting nodes: aggregate lexical-match facts instead of fetching chunks.

The first structured tool node (#133): "how many documents mention X" is a
different query shape from ranked retrieval, answered by an index aggregate
rather than a top-k fetch. Feeds `tool.output`, whose merged values become
the tool's structured result.
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from pydantic import BaseModel, Field

from app.pipelines.definition import PipelineDefinition, PipelineNodeDefinition
from app.pipelines.execution.context import PipelineRunContext
from app.pipelines.node import PipelineNodeBase, PipelineValidationIssue
from app.pipelines.nodes.validators import (
    lexical_count_support_issue,
    missing_index_issue,
)
from app.pipelines.payloads import RetrievalRequestPayload, StructuredValuesPayload
from app.pipelines.ports import NodePort
from app.pipelines.template import DEFAULT_NAMESPACE_TEMPLATE, resolve_collection_template
from app.pipelines.tracing import NodeTraceSummary, NodeTraceValue
from app.pipelines.tracing.summaries import summarize_text
from app.pipelines.variables import STATIC_ONLY_EXTRA
from app.schemas.enums import IndexBackend
from app.services.errors import InvalidInputError, NotFoundError
from app.vectorstores.registry import CAPABILITIES_BY_BACKEND

if TYPE_CHECKING:
    from app.pipelines.registry import NodeRegistry

logger = logging.getLogger(__name__)


class Bm25CountConfig(BaseModel):
    """Configuration for the BM25 count node.

    Index identity mirrors the BM25 retriever (backend, sparse index name,
    namespace template); all identity fields are static-only so purge
    coverage never depends on caller input.
    """

    backend: IndexBackend = Field(
        default=IndexBackend.PGVECTOR, json_schema_extra=STATIC_ONLY_EXTRA
    )
    index_name: str = Field(default="", json_schema_extra=STATIC_ONLY_EXTRA)
    namespace: str = Field(
        default=DEFAULT_NAMESPACE_TEMPLATE, json_schema_extra=STATIC_ONLY_EXTRA
    )


class Bm25CountNode(PipelineNodeBase[Bm25CountConfig]):
    """Count documents/chunks whose text lexically matches the query."""

    type = "count.bm25"
    label = "BM25 Count"
    category = "tools"
    description = (
        "Count how many documents and chunks lexically match the query text "
        "in a sparse BM25 index — an aggregate, not a top-k fetch."
    )
    example = (
        "QueryRequest(text='aurora') -> "
        "StructuredValues(matching_documents=2, matching_chunks=3)."
    )
    input_ports = (NodePort(key="request", label="Request", data_type="query_request"),)
    output_ports = (
        NodePort(key="values", label="Values", data_type="structured_values"),
    )
    config_model = Bm25CountConfig

    @classmethod
    def validation_issues_for_node(
        cls,
        node: PipelineNodeDefinition,
        _definition: PipelineDefinition,
        _registry: NodeRegistry,
    ) -> list[PipelineValidationIssue]:
        """Validate index selection and the backend's lexical-count support."""
        config = cls.config_model.model_validate(node.config or {})
        maybe_issues = [
            missing_index_issue(config.index_name, node.id, "BM25 count"),
            lexical_count_support_issue(
                CAPABILITIES_BY_BACKEND[config.backend], config.backend.value, node.id
            ),
        ]
        return [issue for issue in maybe_issues if issue]

    def run(self, inputs: dict[str, object], context: PipelineRunContext) -> dict[str, object]:
        """Count lexical matches for the query request."""
        payload = RetrievalRequestPayload.model_validate(inputs.get("request"))
        namespace = resolve_collection_template(self.config.namespace, context.collection)
        index_name = (
            resolve_collection_template(self.config.index_name, context.collection)
            or self.config.index_name
        )

        store = context.vector_stores.get(self.config.backend)
        try:
            result = store.lexical_count(
                index_name, namespace or "", text=payload.request.text
            )
            documents, chunks = result.matching_documents, result.matching_chunks
        except NotFoundError:
            # Mirrors the retriever contract: a not-yet-created index holds
            # nothing — an honest zero, not an error.
            logger.info("BM25 index '%s' does not exist yet; counting zero.", index_name)
            documents, chunks = 0, 0
        except InvalidInputError as exc:
            # A misconfigured target (e.g. the name resolves to a dense index)
            # degrades to zero rather than failing the tool run.
            logger.warning("BM25 count on index '%s' skipped: %s", index_name, exc)
            documents, chunks = 0, 0
        return {
            "values": StructuredValuesPayload(
                values={"matching_documents": documents, "matching_chunks": chunks}
            )
        }

    def summarize_io(
        self,
        inputs: dict[str, object],
        outputs: dict[str, object],
    ) -> NodeTraceSummary:
        """Summarize the counted query and its counts."""
        request = RetrievalRequestPayload.model_validate(inputs.get("request")).request
        values = StructuredValuesPayload.model_validate(outputs.get("values")).values
        return NodeTraceSummary(
            inputs=[
                NodeTraceValue(
                    label="Query", value=summarize_text(request.text, 200), kind="text"
                ),
            ],
            outputs=[NodeTraceValue(label="Counts", value=dict(values))],
        )
