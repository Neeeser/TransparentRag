"""Run-history rules: recent FAILED ingestion/retrieval runs.

These read persisted run history (no live probe) and link each failed run to
its trace so a user can see what broke. Advisory only -- a failed run in the
recent history does not mean the collection is currently broken, so these are
warnings and are deliberately excluded from the `consistent` flag.
"""

from __future__ import annotations

from app.db import models
from app.schemas.diagnostics import (
    CollectionDiagnostic,
    DiagnosticCategory,
    DiagnosticLink,
)
from app.services.diagnostics.context import DiagnosticContext
from app.services.diagnostics.rules.base import build_diagnostic


def _run_links(runs: list[models.PipelineRun]) -> list[DiagnosticLink]:
    """Build a trace link per failed run (failures link to the run trace)."""
    return [
        DiagnosticLink(
            label=f"Run {str(run.id)[:8]}",
            route=f"/traces/runs/{run.id}",
            kind="trace",
        )
        for run in runs
    ]


class RecentIngestionFailuresRule:
    """Recent FAILED ingestion runs for the collection (warning)."""

    code = "recent_ingestion_failures"
    category: DiagnosticCategory = "run_failures"

    def evaluate(self, ctx: DiagnosticContext) -> list[CollectionDiagnostic]:
        """Summarize recent failed ingestion runs with links to their traces."""
        failures = ctx.recent_ingestion_failures
        if not failures:
            return []
        return [
            build_diagnostic(
                code=self.code,
                severity="warning",
                confidence="confirmed",
                category=self.category,
                title=f"{len(failures)} recent ingestion failure(s)",
                summary=(
                    "One or more recent ingestion runs failed. Open a run trace "
                    "to see which node broke and why. Documents in a failed run "
                    "were not indexed."
                ),
                links=_run_links(failures),
            )
        ]


class RecentRetrievalFailuresRule:
    """Recent FAILED retrieval runs for the collection (warning)."""

    code = "recent_retrieval_failures"
    category: DiagnosticCategory = "run_failures"

    def evaluate(self, ctx: DiagnosticContext) -> list[CollectionDiagnostic]:
        """Summarize recent failed retrieval runs with links to their traces."""
        failures = ctx.recent_retrieval_failures
        if not failures:
            return []
        return [
            build_diagnostic(
                code=self.code,
                severity="warning",
                confidence="confirmed",
                category=self.category,
                title=f"{len(failures)} recent search failure(s)",
                summary=(
                    "One or more recent searches failed. Open a run trace to see "
                    "which node broke and why."
                ),
                links=_run_links(failures),
            )
        ]
