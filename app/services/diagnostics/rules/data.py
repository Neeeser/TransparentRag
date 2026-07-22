"""Category-C rules: live vector-store probes for the retrieval index.

Unlike the pure-config rules, these contact the store (via the budget-bounded
`VectorStoreProber`) to check that the index retrieval reads actually exists
and holds vectors. Any probe failure degrades to a single informational
"index status unavailable" finding -- the endpoint always returns.
"""

from __future__ import annotations

from app.pipelines.settings import IndexTarget
from app.schemas.diagnostics import (
    CollectionDiagnostic,
    DiagnosticCategory,
    DiagnosticResource,
)
from app.services.diagnostics.context import DiagnosticContext
from app.services.diagnostics.prober import ProbeUnavailable
from app.services.diagnostics.rules.base import build_diagnostic


class IndexProbeRule:
    """Probe every retrieval index target: missing, empty, or reachable.

    Emits `missing_index` (error) when an index retrieval reads does not exist,
    `empty_index` (warning) when it exists but holds no vectors, and
    `index_status_unavailable` (info) when the store cannot be reached.
    """

    code = "index_probe"
    category: DiagnosticCategory = "index_config"

    def evaluate(self, ctx: DiagnosticContext) -> list[CollectionDiagnostic]:
        """Probe each retrieval index target and report existence/count."""
        retrieval = ctx.retrieval_settings
        if retrieval is None:
            return []
        diagnostics: list[CollectionDiagnostic] = []
        for target in retrieval.index_targets:
            diagnostics.extend(self._probe_target(ctx, target, retrieval.namespace))
        return diagnostics

    def _probe_target(
        self,
        ctx: DiagnosticContext,
        target: IndexTarget,
        namespace: str | None,
    ) -> list[CollectionDiagnostic]:
        """Probe one index target, degrading to an info finding on failure."""
        resource = DiagnosticResource(kind="index", name=target.index_name, pipeline_side="retrieval")
        try:
            stats = ctx.prober.stats(target.backend, target.index_name, namespace)
        except ProbeUnavailable:
            return [
                build_diagnostic(
                    code="index_status_unavailable",
                    severity="info",
                    confidence="heuristic",
                    category=self.category,
                    title="Index status unavailable",
                    summary=(
                        f"Could not reach the vector store to check index "
                        f"'{target.index_name}'. This is a transient check "
                        "failure, not a confirmed problem; reload to retry."
                    ),
                    resources=[resource],
                )
            ]
        if not stats.exists:
            return [
                build_diagnostic(
                    code="missing_index",
                    severity="error",
                    confidence="confirmed",
                    category=self.category,
                    title="Retrieval index does not exist",
                    summary=(
                        f"The index '{target.index_name}' retrieval queries does "
                        "not exist in the store yet. Ingest documents to create "
                        "it; searches return nothing until then."
                    ),
                    resources=[resource],
                )
            ]
        if stats.count == 0:
            return [
                build_diagnostic(
                    code="empty_index",
                    severity="warning",
                    confidence="confirmed",
                    category=self.category,
                    title="Retrieval index is empty",
                    summary=(
                        f"The index '{target.index_name}' exists but holds no "
                        "vectors, so searches return nothing. Ingest documents "
                        "into this collection."
                    ),
                    resources=[resource],
                )
            ]
        return []
