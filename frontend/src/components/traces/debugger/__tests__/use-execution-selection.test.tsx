import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useExecutionSelection } from "@/components/traces/debugger/hooks/use-execution-selection";
import { makeNodeRunTrace } from "@/test/fixtures";

import type { TraceGraph, TraceStage, TraceStep } from "@/components/traces/trace-graph";

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
    step("origin::input", "origin"),
    step("retrieval::input", "retrieval"),
    step("retrieval::rank", "retrieval"),
  ],
  combined: true,
};

describe("useExecutionSelection", () => {
  it("owns evidence selection independently from playback", () => {
    const { result } = renderHook(() => useExecutionSelection(graph, true));

    expect(result.current.selectedNodeId).toBe("retrieval::input");
    act(() => result.current.selectNode("origin::input"));
    expect(result.current.selectedNodeId).toBe("origin::input");
    expect(result.current.selectedStep?.stage).toBe("origin");
  });
});
