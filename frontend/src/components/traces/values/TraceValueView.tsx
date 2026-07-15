"use client";

import {
  isChunkBatch,
  isEmbeddingPreview,
  isEmbeddingSummary,
  isItemListTrace,
  isMatchList,
  isMatchOrderArray,
  isScalar,
  isScalarRecord,
  isSource,
  isTextSummary,
} from "@/components/traces/values/shape-guards";
import {
  ChunkListValue,
  EmbeddingValue,
  ItemListValue,
  JsonValue,
  KeyValueView,
  MatchListValue,
  MatchOrderValue,
  ScalarValue,
  SourceValue,
  TextValue,
  type TraceValueViewProps,
} from "@/components/traces/values/TraceValueViews";

type Renderer = {
  id: string;
  match: (value: unknown, kind: string) => boolean;
  Component: React.FC<TraceValueViewProps>;
  itemKind?: "chunks" | "matches";
};

/**
 * Ordered registry of trace value renderers, most specific first with a JSON
 * fallback last. This is the extension point: a new node's output display is
 * a `{ match, Component }` pair added here — nothing else in the trace viewer
 * needs to change. Matching is by value shape (guards) with `kind` as a hint,
 * so a summarizer that emits a known shape gets its pretty view for free.
 * Item-capable renderers receive the optional focus contract so identity stays
 * visible without adding node-type conditionals at the debugger level.
 */
const RENDERERS: Renderer[] = [
  {
    id: "items",
    match: (value, kind) => kind === "items" && isItemListTrace(value),
    Component: ItemListValue,
  },
  {
    id: "text",
    match: (value, kind) => (kind === "text" && typeof value === "string") || isTextSummary(value),
    Component: TextValue,
  },
  { id: "source", match: (value) => isSource(value), Component: SourceValue },
  {
    id: "matches",
    match: (value) => isMatchList(value),
    Component: MatchListValue,
    itemKind: "matches",
  },
  {
    id: "match-order",
    match: (value) => isMatchOrderArray(value),
    Component: MatchOrderValue,
    itemKind: "matches",
  },
  {
    id: "embedding-summary",
    match: (value) => isEmbeddingSummary(value),
    Component: EmbeddingValue,
    itemKind: "chunks",
  },
  {
    id: "embedding-preview",
    match: (value) => isEmbeddingPreview(value),
    Component: EmbeddingValue,
    itemKind: "chunks",
  },
  {
    id: "chunks",
    match: (value) => isChunkBatch(value),
    Component: ChunkListValue,
    itemKind: "chunks",
  },
  { id: "key-value", match: (value) => isScalarRecord(value), Component: KeyValueView },
  { id: "scalar", match: (value) => isScalar(value), Component: ScalarValue },
];

/** Return the item vocabulary a shape-aware renderer can augment from a sibling list. */
export function traceValueItemKind(value: unknown, kind: string) {
  return RENDERERS.find((entry) => entry.match(value, kind))?.itemKind;
}

/** Render a trace summary/payload value using the best-matching view. */
export function TraceValueView({
  value,
  kind,
  focusedItemId,
  onFocusItem,
  itemList,
}: TraceValueViewProps) {
  const renderer = RENDERERS.find((entry) => entry.match(value, kind));
  const Component = renderer?.Component ?? JsonValue;
  return (
    <Component
      value={value}
      kind={kind}
      focusedItemId={focusedItemId}
      onFocusItem={onFocusItem}
      itemList={itemList}
    />
  );
}
