"""Executes a validated pipeline definition against a run context."""

from __future__ import annotations

import logging
from dataclasses import dataclass

from app.pipelines.definition import (
    PipelineDefinition,
    PipelineEdgeDefinition,
    PipelineNodeDefinition,
)
from app.pipelines.execution.context import PipelineRunContext
from app.pipelines.registry import NodeRegistry
from app.pipelines.validation import PipelineValidator

logger = logging.getLogger(__name__)


class PipelineExecutionError(RuntimeError):
    """Raised when pipeline execution fails."""


@dataclass
class PipelineExecutionResult:
    """Pipeline execution outputs."""

    outputs_by_node: dict[str, dict[str, object]]
    terminal_outputs: dict[str, dict[str, object]]


class PipelineExecutor:
    """Executor for pipeline definitions."""

    def __init__(self, registry: NodeRegistry) -> None:
        """Initialize the executor with a node registry."""
        self._registry = registry
        self._validator = PipelineValidator(registry)

    def execute(
        self,
        definition: PipelineDefinition,
        context: PipelineRunContext,
    ) -> PipelineExecutionResult:
        """Validate then run the pipeline definition and return its outputs."""
        validation = self._validator.validate(definition)
        if not validation.valid:
            error = PipelineExecutionError("; ".join(validation.errors))
            if context.trace:
                context.trace.mark_run_failed(error)
            raise error

        try:
            outputs, terminal_outputs = self._execute_nodes(definition, context)
        except Exception as exc:
            if context.trace:
                context.trace.mark_run_failed(exc)
            raise

        if context.trace:
            context.trace.mark_run_completed()
        return PipelineExecutionResult(outputs_by_node=outputs, terminal_outputs=terminal_outputs)

    def _execute_nodes(
        self,
        definition: PipelineDefinition,
        context: PipelineRunContext,
    ) -> tuple[dict[str, dict[str, object]], dict[str, dict[str, object]]]:
        """Run nodes for a pipeline definition and return outputs."""
        node_map = definition.node_map()
        outgoing = definition.outgoing_edges()
        inputs: dict[str, dict[str, object]] = {node_id: {} for node_id in node_map}
        outputs: dict[str, dict[str, object]] = {}
        pending = set(node_map.keys())
        progressed = True

        while pending and progressed:
            progressed = False
            for node_id in list(pending):
                if not self._is_ready(node_id, node_map, inputs):
                    continue

                node_outputs = self._run_node_traced(node_map[node_id], inputs[node_id], context)
                outputs[node_id] = node_outputs
                pending.remove(node_id)
                progressed = True
                self._propagate(node_id, node_outputs, outgoing, inputs)

        self._resolve_stalled(pending, inputs)

        terminal_outputs = {
            node_id: node_outputs
            for node_id, node_outputs in outputs.items()
            if node_id not in outgoing
        }
        return outputs, terminal_outputs

    def _is_ready(
        self,
        node_id: str,
        node_map: dict[str, PipelineNodeDefinition],
        inputs: dict[str, dict[str, object]],
    ) -> bool:
        """Return True when a pending node has all the inputs it needs to run."""
        node_def = node_map[node_id]
        node_spec = self._registry.get_spec(node_def.type)
        if node_spec is None:
            raise PipelineExecutionError(f"Node type '{node_def.type}' not found.")

        available_inputs = inputs[node_id]
        if node_spec.input_ports and not available_inputs:
            return False

        required_inputs = {port.key for port in node_spec.input_ports if port.required}
        return required_inputs.issubset(available_inputs.keys())

    def _run_node_traced(
        self,
        node_def: PipelineNodeDefinition,
        available_inputs: dict[str, object],
        context: PipelineRunContext,
    ) -> dict[str, object]:
        """Instantiate and run a single node, recording trace data when enabled."""
        node = self._registry.create(node_def)
        logger.debug("Executing pipeline node %s (%s)", node_def.id, node_def.type)
        node_run = context.trace.start_node(node_def, available_inputs) if context.trace else None
        try:
            node_outputs = node.run(available_inputs, context)
            summary = (
                node.summarize_io(available_inputs, node_outputs)
                if context.trace and node_run
                else None
            )
        except Exception as exc:
            if context.trace and node_run:
                context.trace.fail_node(node_run, exc)
                context.trace.mark_run_failed(exc)
            raise
        if context.trace and node_run and summary is not None:
            context.trace.finish_node(node_run, node_outputs, summary)
        return node_outputs

    @staticmethod
    def _propagate(
        node_id: str,
        node_outputs: dict[str, object],
        outgoing: dict[str, list[PipelineEdgeDefinition]],
        inputs: dict[str, dict[str, object]],
    ) -> None:
        """Copy a node's outputs onto its downstream edges' target inputs."""
        for edge in outgoing.get(node_id, []):
            output_key = edge.source_port or "default"
            if output_key not in node_outputs:
                continue
            target_inputs = inputs[edge.target]
            input_key = edge.target_port or "default"
            target_inputs[input_key] = node_outputs[output_key]

    @staticmethod
    def _resolve_stalled(
        pending: set[str],
        inputs: dict[str, dict[str, object]],
    ) -> None:
        """Clear branch nodes stalled with no inputs, or raise if any node had inputs."""
        if not pending:
            return
        stalled_without_inputs = [node_id for node_id in pending if not inputs[node_id]]
        if len(stalled_without_inputs) == len(pending):
            logger.info(
                "Skipping %s branch node(s) with no inputs.",
                len(stalled_without_inputs),
            )
            pending.clear()
            return
        missing_nodes = ", ".join(sorted(pending))
        raise PipelineExecutionError(
            f"Pipeline stalled. Missing inputs for nodes: {missing_nodes}."
        )
