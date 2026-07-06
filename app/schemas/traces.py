"""Schema models for pipeline trace responses."""

from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field

from app.pipelines.definition import PipelineDefinition
from app.schemas.base import DateTimeConfigMixin
from app.schemas.enums import PipelineIOType, PipelineKind, PipelineRunStatus


class PipelineRunRead(DateTimeConfigMixin, BaseModel):
    """Pipeline run details returned to clients."""

    id: UUID
    pipeline_id: UUID
    pipeline_version_id: UUID | None
    pipeline_version: int | None
    kind: PipelineKind
    user_id: UUID
    collection_id: UUID
    status: PipelineRunStatus
    error_message: str | None
    started_at: datetime
    completed_at: datetime | None


class PipelineNodeSummaryValueRead(BaseModel):
    """Summary value for a pipeline node input/output."""

    label: str
    value: Any
    kind: str = "json"


class PipelineNodeSummaryRead(BaseModel):
    """Summary of key inputs and outputs for a node."""

    inputs: list[PipelineNodeSummaryValueRead] = Field(default_factory=list)
    outputs: list[PipelineNodeSummaryValueRead] = Field(default_factory=list)


class PipelineNodeRunRead(DateTimeConfigMixin, BaseModel):
    """Node execution details returned to clients."""

    id: UUID
    run_id: UUID
    node_id: str
    node_type: str
    node_name: str
    sequence_index: int
    status: PipelineRunStatus
    error_message: str | None
    started_at: datetime
    completed_at: datetime | None
    duration_ms: float | None
    summary: PipelineNodeSummaryRead


class PipelineNodeIORead(DateTimeConfigMixin, BaseModel):
    """Node input/output payloads returned to clients."""

    id: UUID
    run_id: UUID
    node_run_id: UUID
    node_id: str
    io_type: PipelineIOType
    port: str
    payload: dict[str, Any]


class PipelineTraceResponse(BaseModel):
    """Pipeline trace response payload."""

    run: PipelineRunRead
    definition: PipelineDefinition
    node_runs: list[PipelineNodeRunRead]
    node_io: list[PipelineNodeIORead]
