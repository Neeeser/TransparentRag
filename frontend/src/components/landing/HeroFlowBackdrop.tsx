"use client";

import { useMemo, useSyncExternalStore } from "react";

import { buildDemoFlow } from "@/components/landing/lib/demo-flow";
import { FlowPlayer } from "@/components/pipelines/flow/FlowPlayer";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

/**
 * Subscribe to the user's reduced-motion preference the hydration-safe way:
 * the server snapshot assumes motion is allowed (the permissive default), and
 * `useSyncExternalStore` reconciles the real value on the client without a
 * setState-in-effect.
 */
function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const media = window.matchMedia(REDUCED_MOTION_QUERY);
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    },
    () => window.matchMedia(REDUCED_MOTION_QUERY).matches,
    () => false,
  );
}

/**
 * The hero's signature: a synthetic RAG pipeline running continuously behind
 * the headline, with a document payload flowing Parse → Chunk → Embed → Index
 * → Retrieve → Chat. It renders through the *same* `FlowPlayer` the trace
 * viewer uses, so the two stay visually in lockstep — but fed hand-authored,
 * in-memory data (no telemetry, no traces, no network). Purely decorative:
 * non-interactive, aria-hidden, faded at the edges so it never competes with
 * the copy on top. Autoplay is suppressed under `prefers-reduced-motion`.
 */
export function HeroFlowBackdrop() {
  const { nodes, edges, steps } = useMemo(() => buildDemoFlow(), []);
  const animate = !usePrefersReducedMotion();

  return (
    // The synthetic pipeline is a single horizontal row, so the mask is a wide,
    // short ellipse: the flow reads as a band running across the hero's middle,
    // fading out above and below (clearing the headline and subhead) and at the
    // left/right edges. The hero copy leaves a clear gap here for it to run
    // through — see LandingPage.
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 opacity-30 [mask-image:radial-gradient(105%_42%_at_50%_50%,black_45%,transparent_85%)]"
    >
      <FlowPlayer nodes={nodes} edges={edges} steps={steps} ambient autoPlay={animate} />
    </div>
  );
}
