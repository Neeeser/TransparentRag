import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useSceneRotation } from "@/components/landing/hooks/use-scene-rotation";
import { LANDING_SCENES } from "@/components/landing/lib/scenes";

const HOLD_MS = 1000;
const FADE_MS = 400;

describe("useSceneRotation", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("starts deterministically on the first scene, not fading", () => {
    const { result } = renderHook(() => useSceneRotation(LANDING_SCENES));

    expect(result.current.scene.id).toBe(LANDING_SCENES[0].id);
    expect(result.current.fading).toBe(false);
  });

  it("holds, fades out, then swaps to a different scene after a run completes", () => {
    const { result } = renderHook(() => useSceneRotation(LANDING_SCENES));
    const first = result.current.scene.id;

    act(() => result.current.onRunComplete());
    // Still holding on the completed state.
    expect(result.current.fading).toBe(false);
    expect(result.current.scene.id).toBe(first);

    act(() => vi.advanceTimersByTime(HOLD_MS));
    expect(result.current.fading).toBe(true);
    expect(result.current.scene.id).toBe(first); // swap happens under the fade

    act(() => vi.advanceTimersByTime(FADE_MS));
    expect(result.current.fading).toBe(false);
    expect(result.current.scene.id).not.toBe(first);
  });

  it("never repeats the current scene across many rotations", () => {
    const { result } = renderHook(() => useSceneRotation(LANDING_SCENES));

    for (let i = 0; i < 25; i += 1) {
      const before = result.current.scene.id;
      act(() => {
        result.current.onRunComplete();
        vi.advanceTimersByTime(HOLD_MS + FADE_MS);
      });
      expect(result.current.scene.id).not.toBe(before);
    }
  });

  it("cancels pending rotation timers on unmount", () => {
    const { result, unmount } = renderHook(() => useSceneRotation(LANDING_SCENES));

    act(() => result.current.onRunComplete());
    unmount();
    // Advancing past both windows after unmount must not warn/setState.
    act(() => vi.advanceTimersByTime(HOLD_MS + FADE_MS));
    expect(vi.getTimerCount()).toBe(0);
  });
});
