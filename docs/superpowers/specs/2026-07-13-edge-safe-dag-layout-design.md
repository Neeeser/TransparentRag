# Edge-safe DAG layout design

## Goal

Make Tidy produce deterministic, readable layouts for arbitrary pipeline DAGs while
ensuring nodes do not overlap and routed edges do not intersect unrelated node cards.
The saved node positions and viewport fitting behavior remain unchanged.

## Constraints

- The algorithm is general and must not inspect pipeline kind, node type, node ID, or
  shipped pipeline identity.
- Layout remains synchronous so existing load, Tidy, trace, and layout-persistence call
  sites keep their current lifecycle.
- Existing semantic edge colors, selection emphasis, validation state, and trace playback
  animation remain intact.
- Layout and routing are deterministic for unchanged node and edge inputs.
- The editor must remain usable for larger graphs without excessive layout time or canvas
  growth.

## Evaluated approaches

### Hybrid layered placement plus obstacle-aware routing (selected)

Retain a small pure TypeScript placement module and use
`@tisoap/react-flow-smart-edge` for orthogonal grid A\* routing. The package supports
React Flow 12, is MIT licensed, is current at version 4.13.0, and is approximately
0.88 MB unpacked. Its low-level API lets `TypedEdge` retain Ragworks' visuals and
animation while replacing only path geometry.

This is the narrowest change that can guarantee edge-versus-node safety. React Flow's
endpoint-only smooth-step path cannot account for intermediate node obstacles, and node
placement alone cannot prevent every long edge from crossing a populated intermediate
layer.

### ELK layered layout and orthogonal routing

ELK directly returns node positions and edge bend points and is the strongest integrated
layout engine considered. It is not selected because its JavaScript API is asynchronous,
its unpacked package is approximately 8 MB, and adopting its waypoints would require a
broader editor, load, trace, and persistence lifecycle refactor.

### Custom placement and custom A\* routing

A project-owned router would avoid a dependency but would duplicate a difficult geometric
algorithm, including endpoint escape, obstacle inflation, fallback behavior, and
performance tuning. That adds correctness and maintenance risk without product-specific
benefit.

## Placement architecture

`layoutPipelineNodes` remains a pure function returning node copies with new positions.
It will:

1. Filter graph relations to known nodes and discover weakly connected components.
2. Assign each component's nodes to longest-path layers with deterministic ordering.
3. Minimize crossings using alternating forward and backward barycenter sweeps. Stable
   node order is the tie-breaker.
4. Seed each layer as a non-overlapping vertical stack using React Flow's measured card
   dimensions when available and conservative rendered-card estimates before measurement.
5. Repeatedly center nodes toward the average of adjacent predecessors and successors,
   resolving collisions after each sweep while preserving the chosen order.
6. Normalize each component to the origin and pack disconnected components into
   deterministic two-dimensional shelves with fixed component gaps and a bounded target
   width.

The result centers fan-out branches around their source and merge nodes among all inputs
instead of top-aligning every layer. Longest-path layering keeps edges predominantly
left-to-right and preserves sufficient horizontal clearance for routed bends.

## Routing architecture

One `SmartEdgeBatchRoutingProvider` projects live obstacle geometry and sends every visible
edge to the package's inlined routing Web Worker as one coalesced batch. `TypedEdge`
registers its endpoints with `useSmartEdgeRoute` and consumes the published path without
subscribing to the full React Flow node collection or running A\* during render. The
projection keeps a stable node-array identity across status and style changes, but changes
immediately for position or size updates, so manual drags cannot retain stale waypoints.

If the router cannot find a path, `TypedEdge` falls back to the existing smooth-step path
instead of disappearing. The existing `BaseEdge` styles and animated payload circles use
the selected path unchanged.

## Testing

Pure geometry fixtures cover linear, fan-out, fan-in, diamond, unequal-depth merge,
nested branch/merge, consecutive merges, measured signature cards, disconnected
components, and the shipped hybrid topology. Shared helpers use independent rendered-card
dimensions and handle offsets, route every edge through the package's batch core with the
same production routing options, and assert:

- no node rectangles overlap;
- no routed segment intersects an unrelated node rectangle;
- repeated layout returns identical positions;
- a representative larger graph stays within a bounded layout extent and timing budget.

Component coverage verifies the provider is present, state-only node updates do not
invalidate obstacle geometry, geometry updates do, and `TypedEdge` uses the batch route
while preserving semantic styling and animation behavior. Fallback coverage verifies a
native smooth-step remains visible while the worker route is pending. The regression suite
is run red against the old implementation, then green after the new placement and routing
implementation.

## Visual and accessibility impact

No controls, text, colors, typography, or interaction semantics change. Edge paths gain
extra bends only when required to clear nodes. Automated component checks confirm semantic
wire colors and playback paths remain intact. Manual light/dark browser verification was
not completed because the browser-control session was unavailable, so it remains a visual
QA follow-up rather than a confirmed result.
