"use client";

import { ArrowDown, ArrowUp } from "lucide-react";

import type { JourneyStep } from "@/components/traces/lib/journey";

type JourneyStripProps = {
  journey: JourneyStep[];
  activeNodeId: string | null;
  onSelect: (nodeId: string) => void;
};

const effectLabel = (effect: JourneyStep["effect"]): string => {
  if (effect === "passed") return "passed through";
  return effect;
};

function RankDelta({ delta }: { delta: number | null }) {
  if (!delta) return null;
  const Icon = delta > 0 ? ArrowUp : ArrowDown;
  return (
    <span className={delta > 0 ? "text-data-pos" : "text-data-neg"}>
      <Icon className="inline h-3 w-3" aria-hidden /> {Math.abs(delta)}
    </span>
  );
}

/** Horizontal node-local account of one focused result's trace journey. */
export function JourneyStrip({ journey, activeNodeId, onSelect }: JourneyStripProps) {
  return (
    <section
      aria-label="Result journey"
      className="shrink-0 border-t border-hairline bg-surface px-3 py-2"
    >
      <div className="flex items-center gap-2 overflow-x-auto">
        <p className="shrink-0 px-1 font-mono text-[10px] uppercase tracking-[0.28em] text-muted">
          Journey
        </p>
        {journey.map((step) => (
          <button
            key={step.nodeId}
            type="button"
            aria-label={`Go to ${step.nodeName}`}
            aria-current={step.nodeId === activeNodeId ? "step" : undefined}
            onClick={() => onSelect(step.nodeId)}
            className="min-w-40 shrink-0 rounded-xl border border-hairline bg-canvas px-3 py-2 text-left transition hover:border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-violet focus-visible:ring-offset-2 focus-visible:ring-offset-canvas aria-[current=step]:border-accent-cyan/60 aria-[current=step]:bg-accent-cyan/10"
          >
            <span className="block truncate text-xs font-semibold text-primary">
              {step.nodeName}
            </span>
            <span className="mt-1 flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.18em] text-meta">
              <span>{step.role}</span>
              <span className="text-faint">·</span>
              <span>{effectLabel(step.effect)}</span>
            </span>
            <span className="mt-1 flex items-center gap-2 font-mono text-[10px] text-body">
              {step.rank !== null ? <span>#{step.rank}</span> : null}
              {step.score !== null ? <span>{step.score.toFixed(3)}</span> : null}
              <RankDelta delta={step.delta} />
            </span>
          </button>
        ))}
        {journey.length === 0 ? (
          <p className="px-2 text-xs text-muted">No item summaries were recorded.</p>
        ) : null}
      </div>
    </section>
  );
}
