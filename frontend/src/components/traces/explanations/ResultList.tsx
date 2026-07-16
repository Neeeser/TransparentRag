"use client";

import { ArrowRight } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { ItemRef, TraceFocusedItem } from "@/lib/types";

type ResultListProps = {
  title: string;
  ariaLabel: string;
  items: ItemRef[];
  scoreLabel?: string;
  focusedItemId: string | null;
  contextItems: TraceFocusedItem[];
  previews?: ReadonlyMap<string, string>;
  onFocusItem?: (itemId: string) => void;
  compact?: boolean;
};

const scoreText = (score: number): string =>
  Math.abs(score) >= 10 ? score.toFixed(3) : score.toFixed(4);

/** Ordered rank list with local row inspection and an explicit trace action. */
export function ResultList({
  title,
  ariaLabel,
  items,
  scoreLabel,
  focusedItemId,
  contextItems,
  previews = new Map(),
  onFocusItem,
  compact = false,
}: ResultListProps) {
  const initialInspected =
    (focusedItemId && items.some((item) => item.id === focusedItemId) ? focusedItemId : null) ??
    items[0]?.id ??
    null;
  const [inspectedItemId, setInspectedItemId] = useState<string | null>(initialInspected);
  const focusedRef = useRef<HTMLLIElement | null>(null);
  const contextById = useMemo(
    () => new Map(contextItems.map((item) => [item.id, item])),
    [contextItems],
  );
  const inspected = inspectedItemId ? contextById.get(inspectedItemId) : null;
  const inspectedPreview = inspectedItemId ? previews.get(inspectedItemId) : null;

  useEffect(() => {
    focusedRef.current?.scrollIntoView?.({ block: "center", behavior: "auto" });
  }, [focusedItemId]);

  return (
    <section className="min-w-0 rounded-xl border border-hairline bg-surface p-3">
      <div className="flex items-baseline gap-2">
        <h3 className="text-sm font-semibold text-primary">{title}</h3>
        <span className="font-mono text-[10px] text-meta">{items.length} results</span>
        {scoreLabel ? (
          <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.18em] text-accent-cyan">
            {scoreLabel}
          </span>
        ) : null}
      </div>
      <ol
        aria-label={ariaLabel}
        className={cn("mt-2 space-y-1.5 overflow-y-auto pr-1", compact ? "max-h-40" : "max-h-64")}
      >
        {items.map((item, index) => {
          const focused = item.id === focusedItemId;
          const selected = item.id === inspectedItemId;
          const context = contextById.get(item.id);
          const preview = context?.text ?? previews.get(item.id);
          return (
            <li
              key={item.id}
              ref={focused ? focusedRef : undefined}
              aria-current={focused ? "true" : undefined}
            >
              <button
                type="button"
                aria-label={`Inspect result ${item.id}`}
                aria-pressed={selected}
                onClick={() => setInspectedItemId(item.id)}
                className={cn(
                  "w-full rounded-lg border px-2.5 py-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-violet",
                  focused
                    ? "border-accent-cyan/60 bg-accent-cyan/10"
                    : selected
                      ? "border-strong bg-canvas"
                      : "border-transparent hover:border-hairline hover:bg-canvas",
                )}
              >
                <span className="flex items-center gap-2">
                  <span className="w-7 shrink-0 font-mono text-[10px] text-muted">
                    #{index + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-mono text-[10px] text-body">
                    {item.id}
                  </span>
                  {typeof item.score === "number" ? (
                    <span className="shrink-0 font-mono text-[10px] text-accent-cyan">
                      {scoreText(item.score)}
                    </span>
                  ) : null}
                </span>
                {preview ? (
                  <span className="mt-1 block line-clamp-2 pl-9 text-xs leading-relaxed text-body">
                    {preview}
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ol>
      {inspectedItemId ? (
        <div className="mt-3 rounded-lg border border-hairline bg-canvas p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="min-w-0 truncate text-xs font-medium text-primary">
              {inspected?.filename ?? inspectedItemId}
            </span>
            {inspected?.chunk_index !== null && inspected?.chunk_index !== undefined ? (
              <span className="font-mono text-[10px] text-meta">
                chunk {inspected.chunk_index + 1}
              </span>
            ) : null}
            {onFocusItem && inspectedItemId !== focusedItemId ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onFocusItem(inspectedItemId)}
                className="ml-auto gap-1.5"
              >
                Trace this result
                <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </Button>
            ) : null}
          </div>
          <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-body">
            {inspected?.text ?? inspectedPreview ?? "Chunk text was not included in this trace."}
          </p>
        </div>
      ) : null}
    </section>
  );
}
