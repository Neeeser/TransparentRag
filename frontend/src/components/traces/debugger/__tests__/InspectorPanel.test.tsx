import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { InspectorPanel } from "@/components/traces/debugger/InspectorPanel";
import { makeNodeRunTrace } from "@/test/fixtures";

import type { TraceStep } from "@/components/traces/trace-graph";

function makeStep(overrides: Partial<TraceStep["run"] & object> = {}): TraceStep {
  return {
    nodeId: "node-1",
    run: makeNodeRunTrace({
      node_name: "Embedder",
      status: "completed",
      duration_ms: 240,
      summary: {
        inputs: [{ label: "Chunks", value: "chunk data", kind: "text" }],
        outputs: [{ label: "Vectors", value: "vector data", kind: "text" }],
      },
      ...overrides,
    }),
    io: { inputs: [], outputs: [] },
    stage: "retrieval",
    stageLabel: "Retrieval",
  };
}

describe("InspectorPanel", () => {
  it("shows the active node's name, status, and duration", () => {
    render(<InspectorPanel step={makeStep()} />);

    expect(screen.getByRole("heading", { name: "Embedder" })).toBeInTheDocument();
    expect(screen.getByText(/completed/i)).toBeInTheDocument();
    expect(screen.getByText(/240ms/)).toBeInTheDocument();
  });

  it("surfaces a failed node's error message front and center", () => {
    render(
      <InspectorPanel
        step={makeStep({ status: "failed", error_message: "Embedding dimension mismatch" })}
      />,
    );

    expect(screen.getByText("Embedding dimension mismatch")).toBeInTheDocument();
  });

  it("renders inputs and outputs from the node summary", () => {
    render(<InspectorPanel step={makeStep()} />);

    expect(screen.getByText("chunk data")).toBeInTheDocument();
    expect(screen.getByText("vector data")).toBeInTheDocument();
  });
});
