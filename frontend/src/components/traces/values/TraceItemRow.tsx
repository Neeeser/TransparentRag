import { cn } from "@/lib/utils";

import type { ItemListTrace } from "@/lib/types";
import type { ReactNode } from "react";

export type FocusedTraceItem = {
  id: string;
  rank: number;
  score?: number | null;
};

type TraceItemRowProps = {
  itemId: string;
  focused: boolean;
  onFocusItem?: (itemId: string) => void;
  className: string;
  children: ReactNode;
};

/** Item rows become focus entry points when the debugger supplies a handler. */
export function TraceItemRow({
  itemId,
  focused,
  onFocusItem,
  className,
  children,
}: TraceItemRowProps) {
  const classes = cn(
    className,
    focused && "border-accent-cyan/70 bg-accent-cyan/10",
    onFocusItem &&
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-violet focus-visible:ring-offset-2 focus-visible:ring-offset-canvas",
  );
  if (!onFocusItem) {
    return (
      <div className={classes} data-focused={focused || undefined}>
        {children}
      </div>
    );
  }
  return (
    <button
      type="button"
      aria-label={`Focus item ${itemId}`}
      data-focused={focused || undefined}
      onClick={() => onFocusItem(itemId)}
      className={classes}
    >
      {children}
    </button>
  );
}

/** Locate a focused item only when the truncated preview omitted it. */
export function focusedItemOutsidePreview(
  itemList: ItemListTrace | undefined,
  focusedItemId: string | null | undefined,
  previewIds: Array<string | null>,
): FocusedTraceItem | null {
  if (!itemList || !focusedItemId || previewIds.includes(focusedItemId)) return null;
  const index = itemList.items.findIndex((item) => item.id === focusedItemId);
  if (index < 0) return null;
  const item = itemList.items[index];
  return { id: item.id, rank: index + 1, score: item.score };
}

/** Compact node-local rank/score row pinned above a truncated preview. */
export function PinnedFocusedItemRow({
  item,
  onFocusItem,
}: {
  item: FocusedTraceItem | null;
  onFocusItem?: (itemId: string) => void;
}) {
  if (!item) return null;
  return (
    <TraceItemRow
      itemId={item.id}
      focused
      onFocusItem={onFocusItem}
      className="flex w-full items-center gap-2 rounded-xl border border-hairline bg-canvas px-2.5 py-2 text-left"
    >
      <span className="w-8 shrink-0 font-mono text-[10px] text-muted">#{item.rank}</span>
      <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-body">{item.id}</span>
      {typeof item.score === "number" ? (
        <span className="shrink-0 font-mono text-[10px] text-accent-cyan">
          {item.score.toFixed(3)}
        </span>
      ) : null}
    </TraceItemRow>
  );
}
