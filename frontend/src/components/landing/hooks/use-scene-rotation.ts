"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { LandingScene } from "@/components/landing/lib/scenes";

/** How long the completed pipeline holds on screen before fading out. */
const HOLD_MS = 1000;
/** How long the fade-out lasts before the next scene swaps in underneath. */
const FADE_MS = 400;

export type UseSceneRotationResult = {
  scene: LandingScene;
  /** True while the current scene is fading out ahead of the swap. */
  fading: boolean;
  /** Wire to the player's run-complete signal to advance the rotation. */
  onRunComplete: () => void;
};

/** Uniform-random index over `length` choices, excluding `current`. */
const pickNext = (current: number, length: number): number => {
  if (length <= 1) return current;
  const offset = 1 + Math.floor(Math.random() * (length - 1));
  return (current + offset) % length;
};

/**
 * Factorio-intro scene rotation: play a scene to completion, hold briefly,
 * fade out, swap to a random *different* scene, fade back in. The first scene
 * is deterministic (index 0) so the server and client render the same graph;
 * randomness only enters on rotations, which happen long after hydration.
 */
export function useSceneRotation(scenes: LandingScene[]): UseSceneRotationResult {
  const [sceneIndex, setSceneIndex] = useState(0);
  const [fading, setFading] = useState(false);
  const timersRef = useRef<number[]>([]);

  useEffect(
    () => () => {
      timersRef.current.forEach((timer) => window.clearTimeout(timer));
      timersRef.current = [];
    },
    [],
  );

  const onRunComplete = useCallback(() => {
    const holdTimer = window.setTimeout(() => {
      setFading(true);
      const fadeTimer = window.setTimeout(() => {
        setSceneIndex((prev) => pickNext(prev, scenes.length));
        setFading(false);
      }, FADE_MS);
      timersRef.current.push(fadeTimer);
    }, HOLD_MS);
    timersRef.current.push(holdTimer);
  }, [scenes.length]);

  return { scene: scenes[sceneIndex], fading, onRunComplete };
}
