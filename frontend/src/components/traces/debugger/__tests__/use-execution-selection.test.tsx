import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useExecutionSelection } from "@/components/traces/debugger/hooks/use-execution-selection";
import { makeNodeRunTrace } from "@/test/fixtures";

import type { TraceGraph, TraceStage, TraceStep } from "@/components/traces/trace-graph";

const RETRIEVAL_STAGE: TraceStage = "retrieval";
const ORIGIN_INPUT_ID = "origin::input";
const RETRIEVAL_RANK_ID = "retrieval::rank";

const step = (nodeId: string, stage: TraceStage): TraceStep => ({
  nodeId,
  nodeIds: [nodeId],
  run: makeNodeRunTrace({ node_id: nodeId }),
  io: { inputs: [], outputs: [] },
  stage,
  stageLabel: stage === "origin" ? "Ingestion" : "Retrieval",
});

const graph: TraceGraph = {
  nodes: [],
  edges: [],
  steps: [
    step(ORIGIN_INPUT_ID, "origin"),
    step("retrieval::input", RETRIEVAL_STAGE),
    step(RETRIEVAL_RANK_ID, RETRIEVAL_STAGE),
  ],
  combined: true,
};

describe("useExecutionSelection", () => {
  it("owns evidence selection independently from playback", () => {
    const { result } = renderHook(() => useExecutionSelection(graph, true));

    expect(result.current.selectedNodeId).toBe("retrieval::input");
    act(() => result.current.selectNode(ORIGIN_INPUT_ID));
    expect(result.current.selectedNodeId).toBe(ORIGIN_INPUT_ID);
    expect(result.current.selectedStep?.stage).toBe("origin");
  });

  it("resets evidence selection when the trace focus mode changes", () => {
    const { result, rerender } = renderHook(
      ({ focused }: { focused: boolean }) => useExecutionSelection(graph, focused),
      { initialProps: { focused: true } },
    );

    act(() => result.current.selectNode(RETRIEVAL_RANK_ID));
    expect(result.current.selectedNodeId).toBe(RETRIEVAL_RANK_ID);

    rerender({ focused: false });
    expect(result.current.selectedNodeId).toBe(ORIGIN_INPUT_ID);
  });
});
