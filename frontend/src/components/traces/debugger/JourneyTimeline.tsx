"use client";

import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight } from "lucide-react";

import { VariablesTree } from "@/components/traces/debugger/VariablesTree";
import {
  journeySentence,
  UNRECORDED_SECTION_MESSAGE,
} from "@/components/traces/lib/journey-sentences";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { JourneySection, JourneyStep } from "@/components/traces/lib/journey";
import type { TraceStep } from "@/components/traces/trace-graph";

type JourneyTimelineProps = {
  sections: JourneySection[];
  /** Graph steps by node id, for expanding the active card into full detail. */
  traceStepsByNodeId: ReadonlyMap<string, TraceStep>;
  activeNodeId: string | null;
  focusedItemId: string;
  onSelectNode: (nodeId: string) => void;
  onFocusItem: (itemId: string) => void;
  onStepBack: () => void;
  onStepForward: () => void;
};

function RankDelta({ delta }: { delta: number | null }) {
  if (!delta) return null;
  const Icon = delta > 0 ? ArrowUp : ArrowDown;
  return (
    <span
      className={cn(
        "flex items-center gap-0.5 font-mono text-[11px]",
        delta > 0 ? "text-data-pos" : "text-data-neg",
      )}
    >
      <Icon className="h-3 w-3" aria-hidden />
      {Math.abs(delta)}
    </span>
  );
}

/** A step where the result exists carries a filled marker; a miss stays hollow. */
const carriesItem = (step: JourneyStep): boolean =>
  step.effect !== "absent" && step.effect !== "dropped";

function JourneyCard({
  step,
  active,
  traceStep,
  focusedItemId,
  onSelectNode,
  onFocusItem,
}: {
  step: JourneyStep;
  active: boolean;
  traceStep: TraceStep | undefined;
  focusedItemId: string;
  onSelectNode: (nodeId: string) => void;
  onFocusItem: (itemId: string) => void;
}) {
  const miss = step.effect === "absent";
  return (
    <li className="relative pl-6">
      <span
        aria-hidden
        className={cn(
          "absolute left-0 top-3 h-2.5 w-2.5 rounded-full border",
          carriesItem(step)
            ? "border-accent-cyan bg-accent-cyan/60"
            : "border-strong bg-transparent",
        )}
      />
      <button
        type="button"
        onClick={() => onSelectNode(step.nodeId)}
        aria-label={`Journey step ${step.nodeName}`}
        aria-current={active ? "step" : undefined}
        className={cn(
          "w-full rounded-xl border px-3 py-2.5 text-left transition",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-violet focus-visible:ring-offset-2 focus-visible:ring-offset-canvas",
          active
            ? "border-accent-cyan/60 bg-accent-cyan/10"
            : "border-hairline bg-canvas hover:border-strong",
          miss && !active && "opacity-70",
        )}
      >
        <span className="flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-primary">
            {step.nodeName}
          </span>
          {step.rank !== null ? (
            <span className="shrink-0 rounded-full border border-hairline bg-surface-strong px-2 py-0.5 font-mono text-[10px] text-body">
              #{step.rank}
            </span>
          ) : null}
          <RankDelta delta={step.delta} />
        </span>
        <span className={cn("mt-1 block text-xs", miss ? "text-muted" : "text-body")}>
          {journeySentence(step)}
        </span>
      </button>
      {active && traceStep ? (
        <div className="mt-2 space-y-3 rounded-xl border border-hairline bg-surface p-3">
          <VariablesTree
            title="Inputs"
            tone="cyan"
            summaryItems={traceStep.run?.summary.inputs ?? []}
            ioRecords={traceStep.io.inputs}
            focusedItemId={focusedItemId}
            onFocusItem={onFocusItem}
            emptySummaryLabel="No inputs recorded."
          />
          <VariablesTree
            title="Outputs"
            tone="violet"
            summaryItems={traceStep.run?.summary.outputs ?? []}
            ioRecords={traceStep.io.outputs}
            focusedItemId={focusedItemId}
            onFocusItem={onFocusItem}
            emptySummaryLabel="No outputs recorded."
          />
        </div>
      ) : null}
    </li>
  );
}

/**
 * The focused result's story, one card per node that acted on it, grouped by
 * pipeline stage. The active card expands into the node's full recorded
 * inputs/outputs; a stage whose nodes recorded no item identity is labeled as
 * predating result tracing instead of reading as a miss.
 */
export function JourneyTimeline({
  sections,
  traceStepsByNodeId,
  activeNodeId,
  focusedItemId,
  onSelectNode,
  onFocusItem,
  onStepBack,
  onStepForward,
}: JourneyTimelineProps) {
  const cards = sections.flatMap((section) => section.steps);
  const activePosition = cards.findIndex((step) => step.nodeId === activeNodeId);

  return (
    <section aria-label="Result journey" className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-hairline px-4 py-2">
        <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-muted">Journey</p>
        <span className="ml-auto font-mono text-[10px] text-meta">
          {activePosition >= 0
            ? `${activePosition + 1} / ${cards.length}`
            : `${cards.length} steps`}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={onStepBack}
          aria-label="Previous journey step"
          className="flex h-7 w-7 items-center justify-center p-0"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onStepForward}
          aria-label="Next journey step"
          className="flex h-7 w-7 items-center justify-center p-0"
        >
          <ChevronRight className="h-4 w-4" aria-hidden />
        </Button>
      </div>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-3">
        {sections.map((section) => (
          <div key={section.stage}>
            <p className="pb-2 font-mono text-[10px] uppercase tracking-[0.28em] text-meta">
              {section.stageLabel}
            </p>
            {section.recorded ? (
              <ol className="space-y-2 border-l border-hairline/0">
                {section.steps.map((step) => (
                  <JourneyCard
                    key={step.nodeId}
                    step={step}
                    active={step.nodeId === activeNodeId}
                    traceStep={traceStepsByNodeId.get(step.nodeId)}
                    focusedItemId={focusedItemId}
                    onSelectNode={onSelectNode}
                    onFocusItem={onFocusItem}
                  />
                ))}
              </ol>
            ) : (
              <p className="rounded-xl border border-hairline bg-canvas px-3 py-2.5 text-xs text-muted">
                {UNRECORDED_SECTION_MESSAGE}
              </p>
            )}
          </div>
        ))}
        {sections.length === 0 ? (
          <p className="text-xs text-muted">No item summaries were recorded.</p>
        ) : null}
      </div>
    </section>
  );
}
