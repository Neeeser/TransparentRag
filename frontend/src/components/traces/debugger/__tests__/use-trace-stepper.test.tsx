import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useTraceStepper } from "@/components/traces/debugger/hooks/use-trace-stepper";
import { makeNodeRunTrace } from "@/test/fixtures";

import type { TraceGraph, TraceStep } from "@/components/traces/trace-graph";

function makeStep(nodeId: string, status: "completed" | "failed" = "completed"): TraceStep {
  return {
    nodeId,
    nodeIds: [nodeId],
    run: makeNodeRunTrace({ node_id: nodeId, status }),
    io: { inputs: [], outputs: [] },
    stage: "retrieval",
    stageLabel: "Retrieval",
  };
}

function makeGraph(steps: TraceStep[]): TraceGraph {
  return {
    nodes: [],
    edges: steps.slice(1).map((step, index) => ({
      id: `${steps[index].nodeId}-${step.nodeId}`,
      source: steps[index].nodeId,
      target: step.nodeId,
      type: "typed" as const,
    })),
    steps,
    combined: false,
  };
}

function pressKey(key: string, target: EventTarget = window) {
  act(() => {
    target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
  });
}

describe("useTraceStepper", () => {
  it("starts on the first step of a healthy run", () => {
    const graph = makeGraph([makeStep("a"), makeStep("b")]);
    const { result } = renderHook(() => useTraceStepper(graph));

    expect(result.current.playback.activeIndex).toBe(0);
    expect(result.current.activeStep?.nodeId).toBe("a");
  });

  it("opens on the first failed node of a failed run", () => {
    const graph = makeGraph([makeStep("a"), makeStep("b", "failed"), makeStep("c")]);
    const { result } = renderHook(() => useTraceStepper(graph));

    expect(result.current.playback.activeIndex).toBe(1);
    expect(result.current.activeStep?.nodeId).toBe("b");
  });

  it("steps with arrow keys and clamps at the bounds", () => {
    const graph = makeGraph([makeStep("a"), makeStep("b")]);
    const { result } = renderHook(() => useTraceStepper(graph));

    pressKey("ArrowRight");
    expect(result.current.playback.activeIndex).toBe(1);
    pressKey("ArrowRight");
    expect(result.current.playback.activeIndex).toBe(1);
    pressKey("ArrowLeft");
    expect(result.current.playback.activeIndex).toBe(0);
    pressKey("ArrowLeft");
    expect(result.current.playback.activeIndex).toBe(0);
  });

  it("jumps to the first and last steps with Home and End", () => {
    const graph = makeGraph([makeStep("a"), makeStep("b"), makeStep("c")]);
    const { result } = renderHook(() => useTraceStepper(graph));

    pressKey("End");
    expect(result.current.playback.activeIndex).toBe(2);
    pressKey("Home");
    expect(result.current.playback.activeIndex).toBe(0);
  });

  it("toggles playback with the space key", () => {
    const graph = makeGraph([makeStep("a"), makeStep("b")]);
    const { result } = renderHook(() => useTraceStepper(graph));

    expect(result.current.playback.playing).toBe(false);
    pressKey(" ");
    expect(result.current.playback.playing).toBe(true);
    pressKey(" ");
    expect(result.current.playback.playing).toBe(false);
  });

  it("ignores keys while focus is inside a form control", () => {
    const graph = makeGraph([makeStep("a"), makeStep("b")]);
    const { result } = renderHook(() => useTraceStepper(graph));

    const input = document.createElement("input");
    document.body.appendChild(input);
    pressKey("ArrowRight", input);
    expect(result.current.playback.activeIndex).toBe(0);
    input.remove();
  });
});
