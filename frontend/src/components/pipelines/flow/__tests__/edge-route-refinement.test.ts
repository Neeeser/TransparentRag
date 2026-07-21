import { Position } from "@xyflow/react";
import { describe, expect, it } from "vitest";

import { refineEdgeRoute } from "../edge-route-refinement";

import type { RoutingObstacle } from "../edge-route-refinement";
import type { BatchEdgeInput } from "@tisoap/react-flow-smart-edge";

const OPTIONS = { radius: 6, padding: 16 };

const edge = (overrides: Partial<BatchEdgeInput> = {}): BatchEdgeInput => ({
  id: "e",
  source: "a",
  target: "b",
  sourceX: 264,
  sourceY: 74,
  targetX: 500,
  targetY: 88,
  sourcePosition: Position.Right,
  targetPosition: Position.Left,
  preset: "smoothstep",
  ...overrides,
});

// The edge's own endpoint nodes: always in the snapshot, never obstacles.
const endpointNodes: RoutingObstacle[] = [
  { id: "a", position: { x: 0, y: 28 }, measured: { width: 264, height: 92 } },
  { id: "b", position: { x: 500, y: 42 }, measured: { width: 264, height: 92 } },
];

const route = (svgPathString: string, points: number[][]) => ({
  svgPathString,
  edgeCenterX: 382,
  edgeCenterY: 81,
  points,
});

// Captured from routeSmartEdgesBatch (gridRatio 10, nodePadding 16, radius 6):
// a 14px port misalignment gets its whole vertical correction crammed into a
// 10px window at the source node's padding boundary — two radius-6 curves 3px
// apart that render as a squiggle instead of one clean midpoint jog.
const CAPTURED_DY14_PATH =
  "M 264,74 L 270,74 L 275,74Q 280,74 280,79 L 280,82Q 280,88 286,88 L 490,88 L 500,88 ";
const CAPTURED_DY14_POINTS = [
  [270, 74],
  [280, 74],
  [280, 88],
  [490, 88],
];

// Captured dy=148: the router drops right after the source node (x=280)
// while the native drag path jogs at the corridor midpoint — the shape flip
// seen on every grab/drop before refinement canonicalized both.
const CAPTURED_DY148_PATH =
  "M 264,74 L 270,74 L 275,74Q 280,74 280,79 L 280,110 L 280,120 L 280,216Q 280,222 286,222 L 490,222 L 500,222";
const CAPTURED_DY148_POINTS = [
  [270, 74],
  [280, 74],
  [280, 110],
  [280, 120],
  [280, 222],
  [490, 222],
];

describe("refineEdgeRoute", () => {
  it("moves a slight-misalignment correction to one right-angle jog at the corridor midpoint", () => {
    const refined = refineEdgeRoute(
      route(CAPTURED_DY14_PATH, CAPTURED_DY14_POINTS),
      edge(),
      endpointNodes,
      OPTIONS,
    );
    expect(refined.svgPathString).toBe(
      "M 264,74 L 376,74 Q 382,74 382,80 L 382,82 Q 382,88 388,88 L 500,88",
    );
  });

  it("clamps the corner radius on a tiny misalignment instead of overlapping curves", () => {
    // Captured: dy=4 produces radius-6 corners inside a 4px-tall jog.
    const captured = route(
      "M 264,74 L 270,74 L 278,74Q 280,74 280,76 L 280,76Q 280,78 282,78 L 490,78 L 500,78 ",
      [
        [270, 74],
        [280, 74],
        [280, 78],
        [490, 78],
      ],
    );
    const refined = refineEdgeRoute(captured, edge({ targetY: 78 }), endpointNodes, OPTIONS);
    expect(refined.svgPathString).toBe(
      "M 264,74 L 380,74 Q 382,74 382,76 Q 382,78 384,78 L 500,78",
    );
  });

  it("straightens an exactly aligned route into a single line", () => {
    const captured = route("M 264,74 L 270,74 L 280,74 L 490,74 L 500,74 ", [
      [270, 74],
      [280, 74],
      [490, 74],
    ]);
    const refined = refineEdgeRoute(captured, edge({ targetY: 74 }), endpointNodes, OPTIONS);
    expect(refined.svgPathString).toBe("M 264,74 L 500,74");
  });

  it("canonicalizes a clear fan-out branch to the same midpoint jog the drag path draws", () => {
    const refined = refineEdgeRoute(
      route(CAPTURED_DY148_PATH, CAPTURED_DY148_POINTS),
      edge({ targetY: 222 }),
      endpointNodes,
      OPTIONS,
    );
    expect(refined.svgPathString).toBe(
      "M 264,74 L 376,74 Q 382,74 382,80 L 382,216 Q 382,222 388,222 L 500,222",
    );
  });

  it("keeps the router's path when the midpoint corridor would cross a node card", () => {
    // A node straddling x=382 inside the source→target band: the canonical
    // vertical would cut through it, so the node-avoiding route stands.
    const obstacle: RoutingObstacle = {
      id: "blocker",
      position: { x: 340, y: 100 },
      measured: { width: 100, height: 80 },
    };
    const refined = refineEdgeRoute(
      route(CAPTURED_DY148_PATH, CAPTURED_DY148_POINTS),
      edge({ targetY: 222 }),
      [...endpointNodes, obstacle],
      OPTIONS,
    );
    expect(refined.svgPathString).toBe(CAPTURED_DY148_PATH);
  });

  it("never treats the edge's own endpoint nodes as obstacles", () => {
    // The straight source→midpoint run passes through the source node's
    // padding band by construction; that must not veto the canonical shape.
    const hugging: RoutingObstacle[] = [
      { id: "a", position: { x: 0, y: 0 }, measured: { width: 264, height: 148 } },
      { id: "b", position: { x: 500, y: 14 }, measured: { width: 264, height: 148 } },
    ];
    const refined = refineEdgeRoute(
      route(CAPTURED_DY14_PATH, CAPTURED_DY14_POINTS),
      edge(),
      hugging,
      OPTIONS,
    );
    expect(refined.svgPathString).toContain("Q 382,74");
  });

  it("leaves obstacle detours untouched even when ports nearly align", () => {
    // Up-and-over: y leaves the source→target band, so the shape is a dodge,
    // not a grid artifact.
    const captured = route("M 264,74 ...detour...", [
      [280, 74],
      [280, -40],
      [490, -40],
      [490, 88],
    ]);
    const refined = refineEdgeRoute(captured, edge(), endpointNodes, OPTIONS);
    expect(refined.svgPathString).toBe(captured.svgPathString);
  });

  it("leaves backtracking routes (target left of source) untouched", () => {
    const captured = route("M 264,74 ...backtrack...", [
      [280, 74],
      [200, 74],
      [200, 88],
    ]);
    const refined = refineEdgeRoute(captured, edge({ targetX: 180 }), endpointNodes, OPTIONS);
    expect(refined.svgPathString).toBe(captured.svgPathString);
  });

  it("passes routes with no waypoints through untouched", () => {
    const captured = route("opaque", []);
    expect(refineEdgeRoute(captured, edge(), endpointNodes, OPTIONS).svgPathString).toBe("opaque");
  });

  it("only applies to left-to-right horizontal flows", () => {
    const captured = route("M 264,74 vertical-flow", [[280, 74]]);
    const refined = refineEdgeRoute(
      captured,
      edge({ sourcePosition: Position.Bottom, targetPosition: Position.Top }),
      endpointNodes,
      OPTIONS,
    );
    expect(refined.svgPathString).toBe(captured.svgPathString);
  });
});
