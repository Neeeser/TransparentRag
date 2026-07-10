import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useFlowPlayback } from "@/components/pipelines/flow/use-flow-playback";

const steps = [{ nodeId: "a" }, { nodeId: "b" }];
const edges = [{ id: "a-b", source: "a", target: "b" }];
const PROCESS_MS = 1000;
const TRAVEL_MS = 650;

/** Advance one full step: the node processes, then the payload crosses its edge. */
function advanceOneHop() {
  act(() => vi.advanceTimersByTime(PROCESS_MS));
  act(() => vi.advanceTimersByTime(TRAVEL_MS));
}

describe("useFlowPlayback loop", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("restarts from the first step and keeps playing when loop is set", () => {
    const { result } = renderHook(() =>
      useFlowPlayback({ steps, edges, autoPlay: true, loop: true }),
    );

    advanceOneHop();
    expect(result.current.activeIndex).toBe(1); // reached the last step

    // At the end, one more process window loops back to the start.
    act(() => vi.advanceTimersByTime(PROCESS_MS));
    expect(result.current.activeIndex).toBe(0);
    expect(result.current.playing).toBe(true);
  });

  it("stops at the end when loop is not set", () => {
    const { result } = renderHook(() =>
      useFlowPlayback({ steps, edges, autoPlay: true, loop: false }),
    );

    advanceOneHop();
    expect(result.current.activeIndex).toBe(1);

    act(() => vi.advanceTimersByTime(PROCESS_MS));
    expect(result.current.playing).toBe(false);
    expect(result.current.activeIndex).toBe(1);
  });
});

describe("useFlowPlayback initialIndex", () => {
  it("starts playback on the given step instead of the first", () => {
    const { result } = renderHook(() => useFlowPlayback({ steps, edges, initialIndex: 1 }));

    expect(result.current.activeIndex).toBe(1);
    expect(result.current.playing).toBe(false);
  });

  it("clamps an out-of-range initialIndex to the last step", () => {
    const { result } = renderHook(() => useFlowPlayback({ steps, edges, initialIndex: 99 }));

    expect(result.current.activeIndex).toBe(1);
  });
});
