"use client";

import { formatDuration } from "@/components/traces/debugger/format";
import { VariablesTree } from "@/components/traces/debugger/VariablesTree";
import { cn } from "@/lib/utils";

import type { TraceStep } from "@/components/traces/trace-graph";
import type { PipelineNodeRunTrace } from "@/lib/types";

/** The active node's name, status pill, duration, and stage — one line. */
function InspectorStatusLine({
  step,
  run,
}: {
  step: TraceStep | null;
  run: PipelineNodeRunTrace | null;
}) {
  const failed = run?.status === "failed";
  const duration = formatDuration(run?.duration_ms);

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-hairline px-4 py-2.5">
      <h2 className="min-w-0 truncate text-sm font-semibold text-primary">
        {run?.node_name || step?.nodeId || "—"}
      </h2>
      {run && (
        <span
          className={cn(
            "rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.2em]",
            failed
              ? "border-data-neg/50 text-data-neg"
              : "border-hairline bg-surface-strong text-muted",
          )}
        >
          {run.status}
        </span>
      )}
      {duration && (
        <span className="font-mono text-[10px] tracking-[0.08em] text-meta">{duration}</span>
      )}
      {step && (
        <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.28em] text-meta">
          {step.stageLabel}
        </span>
      )}
    </div>
  );
}

type InspectorPanelProps = {
  step: TraceStep | null;
  focusedItemId?: string | null;
  onFocusItem?: (itemId: string) => void;
};

/**
 * The debugger's bottom panel: the active node's status line (with any error
 * front and center) above its inputs/outputs variables trees. Keyed remounts
 * (by the parent) reset row expansion when the step changes.
 */
export function InspectorPanel({ step, focusedItemId, onFocusItem }: InspectorPanelProps) {
  const run = step?.run ?? null;
  const summary = run?.summary ?? { inputs: [], outputs: [] };
  const errorMessage = run?.status === "failed" ? run.error_message : null;

  return (
    <section aria-label="Node inspector" className="flex h-full min-h-0 flex-col">
      <InspectorStatusLine step={step} run={run} />
      {errorMessage && (
        <div className="mx-4 mt-3 shrink-0 rounded-xl border border-data-neg/40 bg-data-neg/10 px-3 py-2 text-sm text-data-neg">
          {errorMessage}
        </div>
      )}
      <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-4 md:grid-cols-2">
        <VariablesTree
          title="Inputs"
          tone="cyan"
          summaryItems={summary.inputs}
          ioRecords={step?.io.inputs ?? []}
          focusedItemId={focusedItemId}
          onFocusItem={onFocusItem}
          emptySummaryLabel="No inputs recorded."
        />
        <VariablesTree
          title="Outputs"
          tone="violet"
          summaryItems={summary.outputs}
          ioRecords={step?.io.outputs ?? []}
          focusedItemId={focusedItemId}
          onFocusItem={onFocusItem}
          emptySummaryLabel="No outputs recorded."
        />
      </div>
    </section>
  );
}
