import {
  isEmbeddingPreview,
  isEmbeddingSummary,
  isItemListTrace,
  isMatchList,
  isSource,
  isTextSummary,
} from "@/components/traces/values/shape-guards";

import type { TraceStep } from "@/components/traces/trace-graph";
import type {
  EmbeddingPreviewShape,
  EmbeddingSummaryShape,
  MatchListShape,
  SourceShape,
  TextSummaryShape,
} from "@/components/traces/values/shape-guards";
import type { ItemListTrace, PipelineNodeSummaryValue } from "@/lib/types";

export type LocatedItemList = { label: string; list: ItemListTrace };

const values = (step: TraceStep, side: "inputs" | "outputs"): PipelineNodeSummaryValue[] =>
  step.run?.summary[side] ?? [];

export const itemLists = (step: TraceStep, side: "inputs" | "outputs"): LocatedItemList[] =>
  values(step, side).flatMap((value) =>
    value.kind === "items" && isItemListTrace(value.value)
      ? [{ label: value.label, list: value.value }]
      : [],
  );

const findShape = <T>(
  entries: PipelineNodeSummaryValue[],
  guard: (value: unknown) => value is T,
): T | null => entries.find((entry) => guard(entry.value))?.value as T | null;

export const sourceSummary = (step: TraceStep, side: "inputs" | "outputs"): SourceShape | null =>
  findShape(values(step, side), isSource);

export const textSummary = (step: TraceStep, side: "inputs" | "outputs"): TextSummaryShape | null =>
  findShape(values(step, side), isTextSummary);

export const matchSummary = (step: TraceStep, side: "inputs" | "outputs"): MatchListShape | null =>
  findShape(values(step, side), isMatchList);

export const embeddingSummary = (
  step: TraceStep,
  side: "inputs" | "outputs",
): EmbeddingSummaryShape | EmbeddingPreviewShape | null => {
  const entries = values(step, side);
  return findShape(entries, isEmbeddingSummary) ?? findShape(entries, isEmbeddingPreview) ?? null;
};

export const summaryValue = (step: TraceStep, label: string): unknown => {
  const all = [...values(step, "inputs"), ...values(step, "outputs")];
  return all.find((entry) => entry.label === label)?.value;
};

export const previewTextById = (summary: MatchListShape | null): Map<string, string> =>
  new Map(summary?.top_matches.map((match) => [match.chunk_id, match.preview]) ?? []);
