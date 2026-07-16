"use client";

import { useCallback, useMemo, useState } from "react";

import { initialExecutionNodeId } from "@/components/traces/lib/execution";

import type { TraceGraph, TraceStep } from "@/components/traces/trace-graph";

export type UseExecutionSelectionResult = {
  selectedNodeId: string | null;
  selectedStep: TraceStep | null;
  selectNode: (nodeId: string) => void;
};

/** Own the evidence pane's node selection separately from graph playback. */
export function useExecutionSelection(
  graph: TraceGraph,
  focused: boolean,
): UseExecutionSelectionResult {
  const initialNodeId = useMemo(() => initialExecutionNodeId(graph, focused), [graph, focused]);
  const [selection, setSelection] = useState(() => ({
    initialNodeId,
    selectedNodeId: initialNodeId,
  }));
  const selectedNodeId =
    selection.initialNodeId === initialNodeId ? selection.selectedNodeId : initialNodeId;
  const selectNode = useCallback(
    (nodeId: string) => setSelection({ initialNodeId, selectedNodeId: nodeId }),
    [initialNodeId],
  );

  return {
    selectedNodeId,
    selectedStep: graph.steps.find((step) => step.nodeId === selectedNodeId) ?? null,
    selectNode,
  };
}
