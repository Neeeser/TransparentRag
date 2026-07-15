import { isItemListTrace } from "@/components/traces/values/shape-guards";

import type { TraceGraph, TraceStep } from "@/components/traces/trace-graph";
import type { ItemListTrace, ItemRef, PipelineNodeSummaryValue } from "@/lib/types";

export type JourneyEffect =
  | "created"
  | "reordered"
  | "passed"
  | "dropped"
  | "absent"
  | "merged"
  | "introduced";

export type JourneyStep = {
  nodeId: string;
  nodeName: string;
  role: string;
  rank: number | null;
  score: number | null;
  delta: number | null;
  effect: JourneyEffect;
};

export type JourneyFocus = {
  traveledNodeIds: Set<string>;
  absentNodeIds: Set<string>;
  traveledEdgeIds: Set<string>;
  absentEdgeIds: Set<string>;
  storeNodeIds: Set<string>;
};

type ListValue = {
  label: string;
  trace: ItemListTrace;
};

type LocatedItem = {
  list: ListValue;
  item: ItemRef;
  rank: number;
};

type StepItemLists = {
  inputs: ListValue[];
  outputs: ListValue[];
};

const itemLists = (values: PipelineNodeSummaryValue[]): ListValue[] =>
  values.flatMap((value) =>
    value.kind === "items" && isItemListTrace(value.value)
      ? [{ label: value.label, trace: value.value }]
      : [],
  );

const locate = (lists: ListValue[], focusedItemId: string): LocatedItem[] =>
  lists.flatMap((list) => {
    const index = list.trace.items.findIndex((item) => item.id === focusedItemId);
    if (index === -1) return [];
    return [{ list, item: list.trace.items[index], rank: index + 1 }];
  });

const bestRank = (items: LocatedItem[]): LocatedItem | null =>
  items.reduce<LocatedItem | null>(
    (best, item) => (!best || item.rank < best.rank ? item : best),
    null,
  );

const deriveEffect = (
  inputLists: ListValue[],
  inputItem: LocatedItem | null,
  outputItem: LocatedItem | null,
  role: string,
): JourneyEffect => {
  if (!outputItem) return inputItem ? "dropped" : "absent";
  if (inputLists.length === 0) return role === "chunks" ? "created" : "introduced";
  if (!inputItem) return "introduced";
  if (inputLists.length > 1) return "merged";
  return inputItem.rank === outputItem.rank ? "passed" : "reordered";
};

const stepItemLists = (step: TraceStep): StepItemLists | null => {
  const summary = step.run?.summary;
  if (!summary) return null;
  const inputs = itemLists(summary.inputs);
  const outputs = itemLists(summary.outputs);
  return inputs.length === 0 && outputs.length === 0 ? null : { inputs, outputs };
};

const traceRole = (selected: LocatedItem | null, lists: StepItemLists): string =>
  selected?.list.trace.kind ??
  lists.outputs[0]?.trace.kind ??
  lists.inputs[0]?.trace.kind ??
  "items";

const buildJourneyStep = (
  step: TraceStep,
  focusedItemId: string,
  lists: StepItemLists,
): JourneyStep => {
  const inputItem = bestRank(locate(lists.inputs, focusedItemId));
  const outputItem = bestRank(locate(lists.outputs, focusedItemId));
  const selected = outputItem ?? inputItem;
  const role = traceRole(selected, lists);

  return {
    nodeId: step.nodeId,
    nodeName: step.run?.node_name ?? step.nodeId,
    role,
    rank: selected?.rank ?? null,
    score: selected?.item.score ?? null,
    delta: inputItem && outputItem ? inputItem.rank - outputItem.rank : null,
    effect: deriveEffect(lists.inputs, inputItem, outputItem, role),
  };
};

/**
 * Derive one focused result's node-local journey from complete item summary
 * lists. Effects are set/rank arithmetic only: adding a new item-capable node
 * requires item summaries, never a node-type branch in this module.
 */
export const buildJourney = (graph: TraceGraph, focusedItemId: string | null): JourneyStep[] => {
  if (!focusedItemId) return [];

  return graph.steps.flatMap((step) => {
    const lists = stepItemLists(step);
    return lists ? [buildJourneyStep(step, focusedItemId, lists)] : [];
  });
};

/** Build node and edge tint sets from a derived journey. */
export const buildJourneyFocus = (graph: TraceGraph, journey: JourneyStep[]): JourneyFocus => {
  const traveledNodeIds = new Set(
    journey.filter((step) => step.effect !== "absent").map((step) => step.nodeId),
  );
  const absentNodeIds = new Set(
    journey.filter((step) => step.effect === "absent").map((step) => step.nodeId),
  );
  const storeNodeIds = new Set(
    graph.nodes.filter((node) => node.type === "indexStore").map((node) => node.id),
  );
  const traveledEdgeIds = new Set<string>();
  const absentEdgeIds = new Set<string>();

  graph.edges.forEach((edge) => {
    const joinsTraveledNodes = traveledNodeIds.has(edge.source) && traveledNodeIds.has(edge.target);
    const joinsStore =
      (storeNodeIds.has(edge.source) && traveledNodeIds.has(edge.target)) ||
      (traveledNodeIds.has(edge.source) && storeNodeIds.has(edge.target));
    if (joinsTraveledNodes || joinsStore) traveledEdgeIds.add(edge.id);
    else if (absentNodeIds.has(edge.source) || absentNodeIds.has(edge.target)) {
      absentEdgeIds.add(edge.id);
    }
  });

  return { traveledNodeIds, absentNodeIds, traveledEdgeIds, absentEdgeIds, storeNodeIds };
};
