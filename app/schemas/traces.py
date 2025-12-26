"""Schema models for pipeline trace responses."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, Field

from app.db.models import PipelineIOType, PipelineKind, PipelineRunStatus
from app.pipelines.models import PipelineDefinition
from app.schemas.base import DateTimeConfigMixin


class PipelineRunRead(DateTimeConfigMixin, BaseModel):
    """Pipeline run details returned to clients."""

    id: UUID
    pipeline_id: UUID
    pipeline_version_id: Optional[UUID]
    pipeline_version: Optional[int]
    kind: PipelineKind
    user_id: UUID
    collection_id: UUID
    status: PipelineRunStatus
    error_message: Optional[str]
    started_at: datetime
    completed_at: Optional[datetime]


class PipelineNodeSummaryValueRead(BaseModel):
    """Summary value for a pipeline node input/output."""

    label: str
    value: Any
    kind: str = "json"


class PipelineNodeSummaryRead(BaseModel):
    """Summary of key inputs and outputs for a node."""

    inputs: List[PipelineNodeSummaryValueRead] = Field(default_factory=list)
    outputs: List[PipelineNodeSummaryValueRead] = Field(default_factory=list)


class PipelineNodeRunRead(DateTimeConfigMixin, BaseModel):
    """Node execution details returned to clients."""

    id: UUID
    run_id: UUID
    node_id: str
    node_type: str
    node_name: str
    sequence_index: int
    status: PipelineRunStatus
    error_message: Optional[str]
    started_at: datetime
    completed_at: Optional[datetime]
    duration_ms: Optional[float]
    summary: PipelineNodeSummaryRead


class PipelineNodeIORead(DateTimeConfigMixin, BaseModel):
    """Node input/output payloads returned to clients."""

    id: UUID
    run_id: UUID
    node_run_id: UUID
    node_id: str
    io_type: PipelineIOType
    port: str
    payload: Dict[str, Any]


class PipelineTraceResponse(BaseModel):
    """Pipeline trace response payload."""

    run: PipelineRunRead
    definition: PipelineDefinition
    node_runs: List[PipelineNodeRunRead]
    node_io: List[PipelineNodeIORead]
