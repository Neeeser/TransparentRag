import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ExecutionLedger } from "@/components/traces/debugger/ExecutionLedger";
import { buildExecutionSections } from "@/components/traces/lib/execution";
import { makeNodeRunTrace } from "@/test/fixtures";

import type { TraceGraph, TraceStep } from "@/components/traces/trace-graph";

const step = (nodeId: string, nodeName: string): TraceStep => ({
  nodeId,
  nodeIds: [nodeId],
  run: makeNodeRunTrace({ node_id: nodeId, node_name: nodeName }),
  io: { inputs: [], outputs: [] },
  stage: "retrieval",
  stageLabel: "Retrieval",
});

describe("ExecutionLedger", () => {
  it("renders every node and selects one without changing trace focus", () => {
    const graph: TraceGraph = {
      nodes: [],
      edges: [],
      steps: [step("input", "Retrieval input"), step("rank", "RRF fusion")],
      combined: false,
    };
    const onSelectNode = vi.fn();

    render(
      <ExecutionLedger
        sections={buildExecutionSections(graph, null)}
        selectedNodeId="input"
        playbackNodeId="rank"
        onSelectNode={onSelectNode}
      />,
    );

    expect(screen.getByRole("navigation", { name: "Execution order" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Execution step Retrieval input" })).toHaveAttribute(
      "aria-current",
      "step",
    );
    expect(screen.getByText("RRF fusion")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Execution step RRF fusion" }));
    expect(onSelectNode).toHaveBeenCalledWith("rank");
  });
});
