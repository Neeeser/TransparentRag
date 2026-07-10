"use client";

import { Fragment } from "react";

import { getNodeFamilyStyles, resolveNodeFamily } from "@/components/pipelines/lib/pipeline-theme";
import { formatDuration } from "@/components/traces/debugger/format";
import { cn } from "@/lib/utils";

import type { TraceStep } from "@/components/traces/trace-graph";

type StepRailProps = {
  steps: TraceStep[];
  activeIndex: number;
  onSelect: (index: number) => void;
};

/**
 * The debugger's "call stack": every node run in execution order, grouped
 * under stage headers when ingestion and retrieval are joined. Each row jumps
 * playback to its step.
 */
export function StepRail({ steps, activeIndex, onSelect }: StepRailProps) {
  const stages = new Set(steps.map((step) => step.stage));
  const showStageHeaders = stages.size > 1;

  return (
    // Vertical call-stack rail on desktop; a horizontal scrolling strip on
    // small screens (between the graph and the inspector).
    <nav
      aria-label="Trace steps"
      className="flex h-full flex-row items-center gap-1 overflow-x-auto p-2 md:flex-col md:items-stretch md:overflow-y-auto md:overflow-x-hidden md:p-3"
    >
      <p className="hidden px-2 pb-1 font-mono text-[11px] uppercase tracking-[0.28em] text-muted md:block">
        Steps
      </p>
      {steps.map((step, index) => {
        const failed = step.run?.status === "failed";
        const duration = formatDuration(step.run?.duration_ms);
        const family = step.run ? resolveNodeFamily(step.run.node_type) : "other";
        const isNewStage =
          showStageHeaders && (index === 0 || steps[index - 1].stage !== step.stage);
        return (
          <Fragment key={`${step.nodeId}-${index}`}>
            {isNewStage && (
              <p className="shrink-0 px-2 font-mono text-[10px] uppercase tracking-[0.28em] text-meta md:pb-1 md:pt-3 md:first:pt-1">
                {step.stage === "origin" ? "Ingestion" : "Retrieval"}
              </p>
            )}
            <button
              type="button"
              onClick={() => onSelect(index)}
              aria-current={index === activeIndex ? "step" : undefined}
              className={cn(
                "flex shrink-0 items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm transition md:w-full",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-violet focus-visible:ring-offset-2 focus-visible:ring-offset-canvas",
                index === activeIndex
                  ? "bg-surface-strong text-primary"
                  : "text-body hover:bg-surface",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "h-2 w-2 shrink-0 rounded-full",
                  failed ? "bg-data-neg" : getNodeFamilyStyles(family).accent,
                )}
              />
              <span className="min-w-0 flex-1 truncate">{step.run?.node_name || step.nodeId}</span>
              {failed ? (
                <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.2em] text-data-neg">
                  failed
                </span>
              ) : (
                duration && (
                  <span className="shrink-0 font-mono text-[10px] tracking-[0.08em] text-meta">
                    {duration}
                  </span>
                )
              )}
            </button>
          </Fragment>
        );
      })}
    </nav>
  );
}
