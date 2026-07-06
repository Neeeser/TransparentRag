"""Service for resolving pipeline execution traces.

`TraceService` is the one place that turns a `PipelineRun` row (looked up by
run id, document id, or query event id) into the full `PipelineTraceResponse`
the trace API returns. It raises `TraceNotFoundError` (a `ValueError`) for
every "not found" case -- ownership checks, missing runs, and missing
definitions alike -- so the routes stay thin: catch it once, translate to 404.
"""

from __future__ import annotations

from uuid import UUID

from sqlmodel import Session

from app.db import models
from app.db.repositories import (
    DocumentRepository,
    PipelineRepository,
    PipelineRunRepository,
    PipelineVersionRepository,
    QueryRepository,
)
from app.pipelines.definition import PipelineDefinition
from app.schemas.traces import (
    PipelineNodeIORead,
    PipelineNodeRunRead,
    PipelineRunRead,
    PipelineTraceResponse,
)
from app.services.pipelines import PipelineService


class TraceNotFoundError(ValueError):
    """Raised when a requested trace, document, or query event cannot be found."""


class TraceService:
    """Resolves pipeline run traces for the trace API."""

    def __init__(self, session: Session) -> None:
        """Initialize the service with a session and its repositories."""
        self._session = session
        self._runs = PipelineRunRepository(session)
        self._pipelines = PipelineRepository(session)
        self._versions = PipelineVersionRepository(session)
        self._documents = DocumentRepository(session)
        self._queries = QueryRepository(session)

    def get_run_trace(self, run_id: UUID, user_id: UUID) -> PipelineTraceResponse:
        """Return the trace for a pipeline run owned by the user."""
        run = self._runs.get(run_id, user_id=user_id)
        if not run:
            raise TraceNotFoundError("Trace not found.")
        return self._build_trace_response(run)

    def get_document_trace(self, document_id: UUID, user_id: UUID) -> PipelineTraceResponse:
        """Return the ingestion trace for a document owned by the user."""
        document = self._documents.get_for_user(document_id, user_id)
        if not document:
            raise TraceNotFoundError("Document not found.")
        if not document.ingestion_run_id:
            raise TraceNotFoundError("Trace not found.")
        return self.get_run_trace(document.ingestion_run_id, user_id)

    def get_query_event_trace(self, query_event_id: UUID, user_id: UUID) -> PipelineTraceResponse:
        """Return the retrieval trace for a query event owned by the user."""
        event = self._queries.get_for_user(query_event_id, user_id)
        if not event:
            raise TraceNotFoundError("Query event not found.")
        if not event.pipeline_run_id:
            raise TraceNotFoundError("Trace not found.")
        return self.get_run_trace(event.pipeline_run_id, user_id)

    def _resolve_definition(self, run: models.PipelineRun) -> PipelineDefinition:
        """Resolve the pipeline definition a run executed against."""
        if run.pipeline_version_id:
            version = self._versions.get_by_id(run.pipeline_version_id)
            if version:
                return PipelineDefinition.model_validate(version.definition)
        pipeline = self._pipelines.get(run.pipeline_id)
        if not pipeline:
            raise TraceNotFoundError("Pipeline not found.")
        return PipelineService(self._session).get_definition(pipeline)

    def _build_trace_response(self, run: models.PipelineRun) -> PipelineTraceResponse:
        """Build the trace response payload for a pipeline run."""
        node_runs = self._runs.list_node_runs(run.id)
        node_io = self._runs.list_node_io(run.id)
        definition = self._resolve_definition(run)
        return PipelineTraceResponse(
            run=PipelineRunRead.model_validate(run),
            definition=definition,
            node_runs=[
                PipelineNodeRunRead.model_validate(node_run) for node_run in node_runs
            ],
            node_io=[PipelineNodeIORead.model_validate(io_record) for io_record in node_io],
        )
