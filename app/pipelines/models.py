"""Pipeline definition models for node-based workflows."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class PipelineNodePosition(BaseModel):
    """UI positioning metadata for a pipeline node."""

    x: float
    y: float


class PipelineNodeDefinition(BaseModel):
    """Definition of a pipeline node within a workflow."""

    id: str
    type: str
    name: str
    config: dict[str, Any] = Field(default_factory=dict)
    position: PipelineNodePosition | None = None
    ui: dict[str, Any] = Field(default_factory=dict)


class PipelineEdgeDefinition(BaseModel):
    """Definition of a connection between pipeline nodes."""

    id: str
    source: str
    target: str
    source_port: str | None = None
    target_port: str | None = None
    ui: dict[str, Any] = Field(default_factory=dict)


class PipelineDefinition(BaseModel):
    """Complete pipeline graph definition."""

    nodes: list[PipelineNodeDefinition] = Field(default_factory=list)
    edges: list[PipelineEdgeDefinition] = Field(default_factory=list)
    viewport: dict[str, Any] = Field(default_factory=dict)

    def node_map(self) -> dict[str, PipelineNodeDefinition]:
        """Return nodes keyed by id."""
        return {node.id: node for node in self.nodes}

    def outgoing_edges(self) -> dict[str, list[PipelineEdgeDefinition]]:
        """Return edges grouped by source node id."""
        grouped: dict[str, list[PipelineEdgeDefinition]] = {}
        for edge in self.edges:
            grouped.setdefault(edge.source, []).append(edge)
        return grouped

    def incoming_edges(self) -> dict[str, list[PipelineEdgeDefinition]]:
        """Return edges grouped by target node id."""
        grouped: dict[str, list[PipelineEdgeDefinition]] = {}
        for edge in self.edges:
            grouped.setdefault(edge.target, []).append(edge)
        return grouped
