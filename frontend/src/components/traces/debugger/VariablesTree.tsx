"use client";

import { ChevronRight } from "lucide-react";
import { useState } from "react";

import { containsChunkId } from "@/components/traces/trace-payload-utils";
import { TraceValueView } from "@/components/traces/values/TraceValueView";
import { cn } from "@/lib/utils";

import type { PipelineNodeIOTrace, PipelineNodeSummaryValue } from "@/lib/types";
import type { ReactNode } from "react";

type Tone = "cyan" | "violet";

const TONE_TITLE: Record<Tone, string> = {
  cyan: "text-accent-cyan",
  violet: "text-accent-violet",
};

type VariableRowProps = {
  label: string;
  meta?: string | null;
  defaultOpen?: boolean;
  highlighted?: boolean;
  children: ReactNode;
};

/** One collapsible row of the variables panel: a disclosure button + value body. */
function VariableRow({
  label,
  meta,
  defaultOpen = false,
  highlighted = false,
  children,
}: VariableRowProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div
      data-testid={`variable-row-${label}`}
      data-highlighted={highlighted || undefined}
      className={cn(
        "rounded-xl border border-hairline bg-surface",
        highlighted && "border-accent-cyan/70 bg-accent-cyan/10",
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-violet focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
      >
        <ChevronRight
          aria-hidden
          className={cn("h-3.5 w-3.5 shrink-0 text-meta transition", open && "rotate-90")}
        />
        <span className="min-w-0 flex-1 truncate font-mono text-[11px] uppercase tracking-[0.28em] text-muted">
          {label}
        </span>
        {meta && (
          <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.2em] text-meta">
            {meta}
          </span>
        )}
      </button>
      {open && <div className="border-t border-hairline px-3 py-3">{children}</div>}
    </div>
  );
}

type VariablesTreeProps = {
  title: string;
  tone: Tone;
  summaryItems: PipelineNodeSummaryValue[];
  ioRecords: PipelineNodeIOTrace[];
  focusedItemId?: string | null;
  onFocusItem?: (itemId: string) => void;
  emptySummaryLabel: string;
};

/**
 * IDE-style variables panel for one side (Inputs or Outputs) of the active
 * node: summary values open by default, each port's raw payload one collapsed
 * level deeper — everything inspectable, nothing forced on the reader.
 */
export function VariablesTree({
  title,
  tone,
  summaryItems,
  ioRecords,
  focusedItemId,
  onFocusItem,
  emptySummaryLabel,
}: VariablesTreeProps) {
  const highlights = (value: unknown) =>
    Boolean(focusedItemId) && containsChunkId(value, focusedItemId ?? "");
  const visibleSummaryItems = focusedItemId
    ? summaryItems
    : summaryItems.filter((item) => item.kind !== "items");

  return (
    <div className="min-w-0 space-y-2">
      <p className={cn("font-mono text-[11px] uppercase tracking-[0.28em]", TONE_TITLE[tone])}>
        {title}
      </p>
      {visibleSummaryItems.length === 0 && ioRecords.length === 0 ? (
        <p className="text-xs text-muted">{emptySummaryLabel}</p>
      ) : (
        <>
          {visibleSummaryItems.map((item, index) => (
            <VariableRow
              key={`${item.label}-${index}`}
              label={item.label}
              defaultOpen
              highlighted={highlights(item.value)}
            >
              <TraceValueView
                value={item.value}
                kind={item.kind ?? "json"}
                focusedItemId={focusedItemId}
                onFocusItem={onFocusItem}
              />
            </VariableRow>
          ))}
          {ioRecords.map((record) => (
            <VariableRow
              key={`${record.id}-${record.port}`}
              label={record.port}
              meta="raw"
              highlighted={highlights(record.payload)}
            >
              <TraceValueView
                value={record.payload}
                kind="json"
                focusedItemId={focusedItemId}
                onFocusItem={onFocusItem}
              />
            </VariableRow>
          ))}
        </>
      )}
    </div>
  );
}
