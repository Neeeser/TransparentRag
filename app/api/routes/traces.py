"""Trace API routes for pipeline execution visibility."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session

from app.api.dependencies import get_session, require_user_api_keys
from app.db import models
from app.db.repositories import PipelineRunRepository
from app.pipelines.definition import PipelineDefinition
from app.schemas.traces import (
    PipelineNodeIORead,
    PipelineNodeRunRead,
    PipelineRunRead,
    PipelineTraceResponse,
)
from app.services.pipelines import PipelineService

router = APIRouter(prefix="/api", tags=["traces"])


def _resolve_definition(
    run: models.PipelineRun,
    session: Session,
) -> PipelineDefinition:
    """Resolve the pipeline definition for the trace run."""
    if run.pipeline_version_id:
        version = session.get(models.PipelineVersion, run.pipeline_version_id)
        if version:
            return PipelineDefinition.model_validate(version.definition)
    pipeline = session.get(models.Pipeline, run.pipeline_id)
    if not pipeline:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pipeline not found.")
    service = PipelineService(session)
    return service.get_definition(pipeline)


def _build_trace_response(
    run: models.PipelineRun,
    session: Session,
) -> PipelineTraceResponse:
    """Build a trace response payload for a pipeline run."""
    repository = PipelineRunRepository(session)
    node_runs = repository.list_node_runs(run.id)
    node_io = repository.list_node_io(run.id)
    definition = _resolve_definition(run, session)
    return PipelineTraceResponse(
        run=PipelineRunRead(
            id=run.id,
            pipeline_id=run.pipeline_id,
            pipeline_version_id=run.pipeline_version_id,
            pipeline_version=run.pipeline_version,
            kind=run.kind,
            user_id=run.user_id,
            collection_id=run.collection_id,
            status=run.status,
            error_message=run.error_message,
            started_at=run.started_at,
            completed_at=run.completed_at,
            created_at=run.created_at,
            updated_at=run.updated_at,
        ),
        definition=definition,
        node_runs=[
            PipelineNodeRunRead(
                id=node_run.id,
                run_id=node_run.run_id,
                node_id=node_run.node_id,
                node_type=node_run.node_type,
                node_name=node_run.node_name,
                sequence_index=node_run.sequence_index,
                status=node_run.status,
                error_message=node_run.error_message,
                started_at=node_run.started_at,
                completed_at=node_run.completed_at,
                duration_ms=node_run.duration_ms,
                summary=node_run.summary,
                created_at=node_run.created_at,
                updated_at=node_run.updated_at,
            )
            for node_run in node_runs
        ],
        node_io=[
            PipelineNodeIORead(
                id=io_record.id,
                run_id=io_record.run_id,
                node_run_id=io_record.node_run_id,
                node_id=io_record.node_id,
                io_type=io_record.io_type,
                port=io_record.port,
                payload=io_record.payload,
                created_at=io_record.created_at,
                updated_at=io_record.updated_at,
            )
            for io_record in node_io
        ],
    )


@router.get("/pipeline-runs/{run_id}", response_model=PipelineTraceResponse)
def get_pipeline_run_trace(
    run_id: UUID,
    current_user: models.User = Depends(require_user_api_keys),
    session: Session = Depends(get_session),
) -> PipelineTraceResponse:
    """Return the trace for a pipeline run."""
    repository = PipelineRunRepository(session)
    run = repository.get(run_id, user_id=current_user.id)
    if not run:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trace not found.")
    return _build_trace_response(run, session)


@router.get("/documents/{document_id}/trace", response_model=PipelineTraceResponse)
def get_document_trace(
    document_id: UUID,
    current_user: models.User = Depends(require_user_api_keys),
    session: Session = Depends(get_session),
) -> PipelineTraceResponse:
    """Return the ingestion trace for a document."""
    document = session.get(models.Document, document_id)
    if not document or document.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found.")
    if not document.ingestion_run_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trace not found.")
    repository = PipelineRunRepository(session)
    run = repository.get(document.ingestion_run_id, user_id=current_user.id)
    if not run:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trace not found.")
    return _build_trace_response(run, session)


@router.get("/query-events/{query_event_id}/trace", response_model=PipelineTraceResponse)
def get_query_event_trace(
    query_event_id: UUID,
    current_user: models.User = Depends(require_user_api_keys),
    session: Session = Depends(get_session),
) -> PipelineTraceResponse:
    """Return the retrieval trace for a query event."""
    event = session.get(models.QueryEvent, query_event_id)
    if not event or event.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Query event not found.")
    if not event.pipeline_run_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trace not found.")
    repository = PipelineRunRepository(session)
    run = repository.get(event.pipeline_run_id, user_id=current_user.id)
    if not run:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trace not found.")
    return _build_trace_response(run, session)
