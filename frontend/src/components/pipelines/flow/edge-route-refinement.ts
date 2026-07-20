import { Position } from "@xyflow/react";

import type { BatchEdgeInput, BatchRoutingResults } from "@tisoap/react-flow-smart-edge";

type SmartEdgeRoute = BatchRoutingResults[string];

/** The node fields the collision check reads off a routing snapshot. */
export type RoutingObstacle = {
  id: string;
  position: { x: number; y: number };
  measured?: { width?: number | null; height?: number | null } | null;
};

export type RefineOptions = {
  /** Corner rounding of the rebuilt jog; matches the router's borderRadius. */
  radius: number;
  /** Clearance kept from node cards; matches the router's nodePadding. */
  padding: number;
};

type Rect = { left: number; right: number; top: number; bottom: number };

const toRect = (node: RoutingObstacle, padding: number): Rect => ({
  left: node.position.x - padding,
  right: node.position.x + (node.measured?.width ?? 0) + padding,
  top: node.position.y - padding,
  bottom: node.position.y + (node.measured?.height ?? 0) + padding,
});

const isMonotone = (values: number[], direction: number) =>
  values.every((value, index) => {
    if (index === 0) return true;
    const step = value - values[index - 1];
    return step === 0 || (direction !== 0 && Math.sign(step) === direction);
  });

const horizontalBlocked = (x1: number, x2: number, y: number, rect: Rect) =>
  y > rect.top && y < rect.bottom && x2 > rect.left && x1 < rect.right;

const verticalBlocked = (x: number, y1: number, y2: number, rect: Rect) =>
  x > rect.left && x < rect.right && Math.max(y1, y2) > rect.top && Math.min(y1, y2) < rect.bottom;

/**
 * A wire's one definitive shape is the canonical smooth-step: one right-angle
 * jog at the corridor midpoint — exactly what the native fallback draws while
 * the node drags, so grab/drop never flips the wire between two layouts. The
 * grid router instead snaps bends to gridRatio cells beside a node (and crams
 * near-aligned corrections into a squiggle a few pixels wide — captured in
 * edge-route-refinement.test.ts). For monotone routes whose midpoint corridor
 * clears every padded node card, replace the router's path with the canonical
 * shape; obstacle detours, backtracks, and blocked corridors keep the
 * router's node-avoiding path untouched.
 */
export function refineEdgeRoute(
  route: SmartEdgeRoute,
  edge: BatchEdgeInput,
  obstacles: readonly RoutingObstacle[],
  options: RefineOptions,
): SmartEdgeRoute {
  if (route.points.length === 0) return route;
  if (edge.sourcePosition !== Position.Right || edge.targetPosition !== Position.Left) return route;

  const dy = edge.targetY - edge.sourceY;
  const waypoints = [[edge.sourceX, edge.sourceY], ...route.points, [edge.targetX, edge.targetY]];
  const xs = waypoints.map(([x]) => x);
  const ys = waypoints.map(([, y]) => y);
  if (!isMonotone(xs, 1) || !isMonotone(ys, Math.sign(dy))) return route;

  const { sourceX, sourceY, targetX, targetY } = edge;
  const midX = (sourceX + targetX) / 2;
  const blocked = obstacles.some((node) => {
    // The edge legitimately hugs its own endpoint nodes' padding.
    if (node.id === edge.source || node.id === edge.target) return false;
    const rect = toRect(node, options.padding);
    return (
      horizontalBlocked(sourceX, midX, sourceY, rect) ||
      verticalBlocked(midX, sourceY, targetY, rect) ||
      horizontalBlocked(midX, targetX, targetY, rect)
    );
  });
  if (blocked) return route;

  if (dy === 0) {
    return {
      ...route,
      svgPathString: `M ${sourceX},${sourceY} L ${targetX},${targetY}`,
      edgeCenterX: midX,
      edgeCenterY: sourceY,
    };
  }

  const direction = Math.sign(dy);
  const r = Math.min(options.radius, Math.abs(dy) / 2, midX - sourceX, targetX - midX);
  const jogTop = `L ${midX - r},${sourceY} Q ${midX},${sourceY} ${midX},${sourceY + direction * r}`;
  const jogMiddle = Math.abs(dy) > 2 * r ? ` L ${midX},${targetY - direction * r}` : "";
  const jogBottom = `Q ${midX},${targetY} ${midX + r},${targetY}`;
  return {
    ...route,
    svgPathString: `M ${sourceX},${sourceY} ${jogTop}${jogMiddle} ${jogBottom} L ${targetX},${targetY}`,
    edgeCenterX: midX,
    edgeCenterY: (sourceY + targetY) / 2,
  };
}

/** Applies {@link refineEdgeRoute} to every routed edge of a batch result. */
export function refineBatchResults(
  input: { nodes: RoutingObstacle[]; edges: BatchEdgeInput[] },
  results: BatchRoutingResults,
  options: RefineOptions,
): BatchRoutingResults {
  const refined: BatchRoutingResults = {};
  for (const edge of input.edges) {
    const route = results[edge.id];
    if (route) refined[edge.id] = refineEdgeRoute(route, edge, input.nodes, options);
  }
  return refined;
}
