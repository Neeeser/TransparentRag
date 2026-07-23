"""Maps single-pipeline validation issues into collection diagnostics.

The builder's own `validate_pipeline_definition` already finds definition-local
problems (a node missing a required field, an over-limit value). Rather than
re-implement those checks, this rule surfaces them on the collection
Diagnostics tab too, carrying each issue's severity through. It never changes
the builder's `PipelineValidationIssue` contract.
"""

from __future__ import annotations

from app.pipelines.node import PipelineValidationIssue
from app.pipelines.validation import PipelineValidationResult
from app.schemas.diagnostics import (
    CollectionDiagnostic,
    DiagnosticAction,
    DiagnosticCategory,
    DiagnosticResource,
)
from app.services.diagnostics.context import DiagnosticContext
from app.services.diagnostics.rules.base import (
    PipelineSide,
    build_diagnostic,
    pipeline_builder_route,
)


class NodeConfigRule:
    """Surface each side's single-pipeline validation issues as diagnostics."""

    code = "node_config_incomplete"
    category: DiagnosticCategory = "node_config"

    def evaluate(self, ctx: DiagnosticContext) -> list[CollectionDiagnostic]:
        """Map every validation issue on either resolved side to a diagnostic."""
        diagnostics: list[CollectionDiagnostic] = []
        diagnostics.extend(self._map_side("ingestion", ctx.ingestion_validation))
        diagnostics.extend(self._map_side("retrieval", ctx.retrieval_validation))
        return diagnostics

    def _map_side(
        self,
        side: PipelineSide,
        result: PipelineValidationResult | None,
    ) -> list[CollectionDiagnostic]:
        """Build one diagnostic per issue in a side's validation result."""
        if result is None:
            return []
        return [self._map_issue(side, issue) for issue in result.issues]

    def _map_issue(
        self,
        side: PipelineSide,
        issue: PipelineValidationIssue,
    ) -> CollectionDiagnostic:
        """Convert one `PipelineValidationIssue`, carrying its severity through."""
        return build_diagnostic(
            code=self.code,
            severity=issue.severity,
            confidence="confirmed",
            category=self.category,
            title=f"{side.capitalize()} pipeline node needs attention",
            summary=issue.message,
            resources=[
                DiagnosticResource(
                    kind="node",
                    id=issue.node_id,
                    pipeline_side=side,
                )
            ],
            action=DiagnosticAction(
                label=f"Edit {side} pipeline",
                route=pipeline_builder_route(side),
            ),
        )
