# Edge-safe DAG Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Tidy deterministically place arbitrary pipeline DAGs and route every edge around unrelated node cards.

**Architecture:** Keep `layoutPipelineNodes` synchronous and pure, but replace top-aligned columns with component-aware layered ordering and neighbor-centered compaction. Use the maintained React Flow Smart Edge low-level A* router inside `TypedEdge`, retaining all Ragworks-specific styling and playback.

**Tech Stack:** TypeScript, React 19, React Flow 12, Vitest, `@tisoap/react-flow-smart-edge` 4.13.x.

## Global Constraints

- Never branch on pipeline kind, node type, node ID, or shipped-pipeline identity.
- Persist node positions and fit the viewport through the existing layout-persistence hook.
- Preserve semantic wire colors, validation emphasis, selection state, and playback animation.
- Assert geometric invariants, not only hardcoded coordinates.
- Keep routing and layout deterministic with bounded extent and representative larger-graph runtime.

---

### Task 1: Establish geometry regressions

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/package-lock.json`
- Modify: `frontend/src/components/pipelines/lib/__tests__/pipeline-layout.test.ts`
- Create: `frontend/src/components/pipelines/flow/__tests__/TypedEdge.test.tsx`

**Interfaces:**
- Consumes: `layoutPipelineNodes(nodes, edges)` and `TypedEdge(props)`.
- Produces: fixture builders and assertions for node rectangles, routed polyline segments, determinism, extent, and runtime.

- [ ] **Step 1: Add the approved routing dependency without changing behavior**

Run: `npm install @tisoap/react-flow-smart-edge@^4.13.0`

- [ ] **Step 2: Write fixture-first failing geometry tests**

Cover linear, fan-out, fan-in, diamond, unequal branch depth, nested merges, consecutive merges, disconnected components, shipped hybrid topology, repeated layout, and a larger generated DAG. Assert every pair of estimated node rectangles is disjoint and every routed polyline misses unrelated rectangles.

- [ ] **Step 3: Write the failing TypedEdge integration test**

Mock `getSmartEdge` and `useNodes`; render `TypedEdge` and assert the returned route is passed to `BaseEdge` and animated playback circles.

- [ ] **Step 4: Run the focused tests and record RED**

Run: `npm run test:run -- src/components/pipelines/lib/__tests__/pipeline-layout.test.ts src/components/pipelines/flow/__tests__/TypedEdge.test.tsx`

Expected: failures showing top-aligned merge/branch placement and `TypedEdge` not invoking obstacle-aware routing.

### Task 2: Implement deterministic topology-aware placement

**Files:**
- Modify: `frontend/src/components/pipelines/lib/pipeline-layout.ts`
- Modify: `frontend/src/components/pipelines/lib/__tests__/pipeline-layout.test.ts`

**Interfaces:**
- Consumes: React Flow nodes and edges.
- Produces: unchanged `layoutPipelineNodes(nodes, edges): Node<PipelineNodeData>[]` signature.

- [ ] **Step 1: Discover and deterministically order weakly connected components**

Build predecessor/successor maps once, traverse components in stable input order, and filter edges to known node IDs.

- [ ] **Step 2: Assign layers and minimize crossings**

Use longest-path Kahn layering per component followed by alternating forward/backward barycenter sweeps with stable-order tie breaks.

- [ ] **Step 3: Center and compact layers**

Seed non-overlapping vertical stacks, move nodes toward connected-neighbor medians in alternating sweeps, resolve collisions, normalize the component, and pack components vertically with a fixed gap.

- [ ] **Step 4: Run layout tests and keep them green**

Run: `npm run test:run -- src/components/pipelines/lib/__tests__/pipeline-layout.test.ts`

Expected: all layout fixtures pass with identical repeated positions and bounded extent/runtime.

### Task 3: Integrate obstacle-aware TypedEdge routing

**Files:**
- Modify: `frontend/src/components/pipelines/flow/TypedEdge.tsx`
- Modify: `frontend/src/components/pipelines/flow/__tests__/TypedEdge.test.tsx`

**Interfaces:**
- Consumes: React Flow's live node list and edge endpoint coordinates.
- Produces: the existing `TypedEdge` component with a smart orthogonal path and smooth-step fallback.

- [ ] **Step 1: Route with `getSmartEdge`**

Call the router with live nodes, fixed grid ratio/node padding, and the package's orthogonal smooth-step preset; fall back to `getSmoothStepPath` only when routing returns an error.

- [ ] **Step 2: Preserve existing rendering semantics**

Pass the selected path unchanged to `BaseEdge` and both playback `animateMotion` elements. Keep all existing semantic color, width, opacity, and transition rules.

- [ ] **Step 3: Run focused tests and record GREEN**

Run: `npm run test:run -- src/components/pipelines/lib/__tests__/pipeline-layout.test.ts src/components/pipelines/flow/__tests__/TypedEdge.test.tsx`

Expected: all fixture and component tests pass.

### Task 4: Verify, measure, and publish

**Files:**
- Modify if needed: `frontend/src/components/pipelines/lib/pipeline-layout.ts`
- Modify if needed: focused tests above.

**Interfaces:**
- Consumes: completed layout/routing implementation.
- Produces: verification evidence, conventional commit, pushed branch, draft PR, and issue notes.

- [ ] **Step 1: Inspect light and dark rendering**

Run the pipeline editor locally, inspect Tidy on the hybrid fixture in both themes, and confirm wire colors/playback geometry remain legible without unrelated-node intersections.

- [ ] **Step 2: Run frontend gates**

Run: `npm run verify`

Run: `make format-check-frontend`

Expected: both exit 0.

- [ ] **Step 3: Review scope and commit**

Run `git diff --check`, inspect the complete diff, stage only issue #72 files, and commit with `feat(pipelines): make tidy layout edge-safe`.

- [ ] **Step 4: Publish and report measurements**

Push `feat/72-edge-safe-dag-layout`, open a draft PR with `Closes #72`, apply the `feature` label, and comment on #72 with algorithm, dependency, fixture, gate, visual, extent, and timing evidence.
