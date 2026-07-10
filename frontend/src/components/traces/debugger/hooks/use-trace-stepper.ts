"use client";

import { useEffect, useMemo } from "react";

import { useFlowPlayback } from "@/components/pipelines/flow/use-flow-playback";

import type { UseFlowPlaybackResult } from "@/components/pipelines/flow/use-flow-playback";
import type { TraceGraph, TraceStep } from "@/components/traces/trace-graph";

export type UseTraceStepperResult = {
  playback: UseFlowPlaybackResult;
  activeStep: TraceStep | null;
};

/** True when the key press happened inside a control that owns its own keys. */
const isEditableTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
};

/**
 * Debugger stepping over a trace graph: one playback state shared by the rail,
 * the flow graph, and the inspector, plus IDE-style keyboard control
 * (arrows step, Space plays/pauses, Home/End jump). A failed run opens on its
 * first failed node so the page lands on the bug.
 */
export function useTraceStepper(graph: TraceGraph): UseTraceStepperResult {
  const initialIndex = useMemo(() => {
    const failed = graph.steps.findIndex((step) => step.run?.status === "failed");
    return failed === -1 ? 0 : failed;
  }, [graph.steps]);

  const playback = useFlowPlayback({ steps: graph.steps, edges: graph.edges, initialIndex });
  const { activeIndex, stepForward, stepBack, toggle, seek } = playback;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return;
      switch (event.key) {
        case "ArrowRight":
          stepForward();
          break;
        case "ArrowLeft":
          stepBack();
          break;
        case " ":
          event.preventDefault();
          toggle();
          break;
        case "Home":
          seek(0);
          break;
        case "End":
          seek(graph.steps.length - 1);
          break;
        default:
          return;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [stepForward, stepBack, toggle, seek, graph.steps.length]);

  return { playback, activeStep: graph.steps[activeIndex] ?? null };
}
