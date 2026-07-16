"use client";

import { useState } from "react";

import { formatDuration } from "@/components/traces/debugger/format";
import { VariablesTree } from "@/components/traces/debugger/VariablesTree";
import { NodeExplanation } from "@/components/traces/explanations/NodeExplanation";
import { cn } from "@/lib/utils";

import type { PipelineNodeData } from "@/components/pipelines/PipelineNode";
import type { JourneyStep } from "@/components/traces/lib/journey";
import type { TraceStep } from "@/components/traces/trace-graph";
import type { TraceFocusedItem } from "@/lib/types";
import type { Node } from "@xyflow/react";

type EvidenceTab = "explanation" | "data" | "configuration" | "raw";

const TABS: Array<{ id: EvidenceTab; label: string }> = [
  { id: "explanation", label: "Explanation" },
  { id: "data", label: "Node data" },
  { id: "configuration", label: "Configuration" },
  { id: "raw", label: "Raw payload" },
];

type NodeEvidencePanelProps = {
  step: TraceStep | null;
  node: Node<PipelineNodeData> | null;
  focusedItemId: string | null;
  contextItems: TraceFocusedItem[];
  itemEffect: JourneyStep | null;
  inputSources: string[];
  onFocusItem?: (itemId: string) => void;
};

const JsonBlock = ({ value }: { value: unknown }) => (
  <pre className="overflow-auto whitespace-pre-wrap break-words rounded-xl border border-hairline bg-canvas p-4 font-mono text-[11px] leading-relaxed text-body">
    {JSON.stringify(value, null, 2)}
  </pre>
);

/** Stable evidence surface for the selected node. */
export function NodeEvidencePanel({
  step,
  node,
  focusedItemId,
  contextItems,
  itemEffect,
  inputSources,
  onFocusItem,
}: NodeEvidencePanelProps) {
  const [tab, setTab] = useState<EvidenceTab>("explanation");
  const run = step?.run ?? null;
  const failed = run?.status === "failed";
  const duration = formatDuration(run?.duration_ms);
  const summary = run?.summary ?? { inputs: [], outputs: [] };

  return (
    <section aria-label="Node evidence" className="flex h-full min-h-0 flex-col bg-canvas-raised">
      <header className="shrink-0 border-b border-hairline px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="min-w-0 flex-1 truncate text-base font-semibold text-primary">
            {run?.node_name ?? node?.data.label ?? step?.nodeId ?? "Node evidence"}
          </h2>
          {run ? (
            <span
              className={cn(
                "rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em]",
                failed ? "border-data-neg/50 text-data-neg" : "border-hairline text-muted",
              )}
            >
              {run.status}
            </span>
          ) : null}
          {duration ? <span className="font-mono text-[10px] text-meta">{duration}</span> : null}
          {step ? (
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-meta">
              {step.stageLabel}
            </span>
          ) : null}
        </div>
        <div
          className="mt-3 flex gap-1 overflow-x-auto"
          role="tablist"
          aria-label="Node evidence views"
        >
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              onClick={() => setTab(item.id)}
              className={cn(
                "shrink-0 rounded-full px-3 py-1.5 text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-violet",
                tab === item.id
                  ? "bg-surface-strong text-primary"
                  : "text-muted hover:bg-surface hover:text-primary",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5" role="tabpanel">
        {failed && run?.error_message ? (
          <div className="mb-4 rounded-xl border border-data-neg/40 bg-data-neg/10 px-3 py-2 text-sm text-data-neg">
            {run.error_message}
          </div>
        ) : null}

        {tab === "explanation" && step && node ? (
          <NodeExplanation
            step={step}
            node={node}
            focusedItemId={focusedItemId}
            contextItems={contextItems}
            itemEffect={itemEffect}
            inputSources={inputSources}
            onFocusItem={onFocusItem}
          />
        ) : null}

        {tab === "data" ? (
          <div className="grid gap-5 xl:grid-cols-2">
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
        ) : null}

        {tab === "configuration" ? <JsonBlock value={node?.data.config ?? {}} /> : null}

        {tab === "raw" ? (
          <JsonBlock
            value={{
              node_id: step?.nodeId ?? null,
              summary,
              io: step?.io ?? { inputs: [], outputs: [] },
            }}
          />
        ) : null}
      </div>
    </section>
  );
}
