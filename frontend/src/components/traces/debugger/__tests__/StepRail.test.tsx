import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { StepRail } from "@/components/traces/debugger/StepRail";
import { makeNodeRunTrace } from "@/test/fixtures";

import type { TraceStep } from "@/components/traces/trace-graph";

function makeStep(
  nodeId: string,
  overrides: Partial<Parameters<typeof makeNodeRunTrace>[0]> = {},
  stage: TraceStep["stage"] = "retrieval",
): TraceStep {
  return {
    nodeId,
    nodeIds: [nodeId],
    run: makeNodeRunTrace({
      node_id: nodeId,
      node_name: `Node ${nodeId}`,
      duration_ms: 12,
      ...overrides,
    }),
    io: { inputs: [], outputs: [] },
    stage,
    stageLabel: stage === "origin" ? "Ingestion · origin" : "Retrieval",
  };
}

describe("StepRail", () => {
  it("lists every step in execution order with name and duration", () => {
    render(
      <StepRail
        steps={[makeStep("a"), makeStep("b", { duration_ms: 1500 })]}
        activeIndex={0}
        onSelect={() => undefined}
      />,
    );

    const rows = screen.getAllByRole("button");
    expect(rows[0]).toHaveTextContent("Node a");
    expect(rows[0]).toHaveTextContent("12ms");
    expect(rows[1]).toHaveTextContent("Node b");
    expect(rows[1]).toHaveTextContent("1.5s");
  });

  it("marks the active step for assistive tech", () => {
    render(
      <StepRail
        steps={[makeStep("a"), makeStep("b")]}
        activeIndex={1}
        onSelect={() => undefined}
      />,
    );

    expect(screen.getByRole("button", { name: /Node b/ })).toHaveAttribute("aria-current", "step");
    expect(screen.getByRole("button", { name: /Node a/ })).not.toHaveAttribute("aria-current");
  });

  it("jumps to a step when its row is clicked", () => {
    const onSelect = vi.fn();
    render(<StepRail steps={[makeStep("a"), makeStep("b")]} activeIndex={0} onSelect={onSelect} />);

    fireEvent.click(screen.getByRole("button", { name: /Node b/ }));
    expect(onSelect).toHaveBeenCalledWith(1);
  });

  it("flags failed steps", () => {
    render(
      <StepRail
        steps={[makeStep("a"), makeStep("b", { status: "failed", duration_ms: null })]}
        activeIndex={0}
        onSelect={() => undefined}
      />,
    );

    expect(screen.getByRole("button", { name: /Node b/ })).toHaveTextContent(/failed/i);
  });

  it("groups steps under stage headers when the trace is combined", () => {
    render(
      <StepRail
        steps={[makeStep("a", {}, "origin"), makeStep("b", {}, "retrieval")]}
        activeIndex={0}
        onSelect={() => undefined}
      />,
    );

    expect(screen.getByText(/Ingestion/)).toBeInTheDocument();
    expect(screen.getByText(/Retrieval/)).toBeInTheDocument();
  });

  it("shows no stage headers for a single-stage trace", () => {
    render(
      <StepRail
        steps={[makeStep("a"), makeStep("b")]}
        activeIndex={0}
        onSelect={() => undefined}
      />,
    );

    expect(screen.queryByText(/^Retrieval$/)).not.toBeInTheDocument();
  });
});
