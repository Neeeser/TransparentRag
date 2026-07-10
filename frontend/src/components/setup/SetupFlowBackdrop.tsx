"use client";

import { Background, ReactFlow, useReactFlow } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useEffect, useMemo } from "react";

import { buildDemoFlow } from "@/components/landing/lib/demo-flow";
import { pipelineEdgeTypes } from "@/components/pipelines/flow/TypedEdge";
import { useFlowDotColor } from "@/components/pipelines/flow/use-flow-dot-color";
import { pipelineNodeTypes } from "@/components/pipelines/PipelineNode";
import { usePrefersReducedMotion } from "@/lib/use-prefers-reduced-motion";

import type { SetupStepId } from "@/components/setup/lib/setup-wizard-reducer";

/**
 * Which demo-pipeline node each wizard step is "about". `null` frames the
 * whole pipeline (the welcome overview). The camera flies between them as
 * the user advances, so the backdrop narrates what the current choice wires
 * up: the key powers chat, the model powers embedding, the index stores
 * vectors, the collection starts at the document source.
 */
const FOCUS_BY_STEP: Record<SetupStepId, string | null> = {
  welcome: null,
  key: "chat",
  model: "embed",
  index: "index",
  launch: "source",
};

const FLY_MS = 900;
const FOCUS_ZOOM = 1.05;
const OVERVIEW_ZOOM = 0.5;
// Flow-space offsets so the focused node hovers up-right of the step copy
// (which is centered) instead of hiding behind it. Y is large on purpose:
// the band should clear even the tallest step (the model list).
// On wide screens the focused node settles up-right of the centered copy;
// on narrow screens it centers (there is no "beside the copy" to aim for).
const OFFSET_X_DESKTOP = -330;
// Screen-space pixels the focused node is lifted above the viewport center.
const SCREEN_LIFT_PX = 290;

function ViewportDirector({ step }: { step: SetupStepId }) {
  const { setCenter, getNode } = useReactFlow();
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    const duration = reducedMotion ? 0 : FLY_MS;
    // The overview centers on the middle node zoomed out; focused steps fly
    // to their node. Both keep the band high so it never crowds the copy.
    const focusId = FOCUS_BY_STEP[step] ?? "index";
    const zoom = FOCUS_BY_STEP[step] ? FOCUS_ZOOM : OVERVIEW_ZOOM;
    const node = getNode(focusId);
    if (!node) return;
    const width = node.measured?.width ?? 260;
    const height = node.measured?.height ?? 150;
    const offsetX = FOCUS_BY_STEP[step] && window.innerWidth >= 768 ? OFFSET_X_DESKTOP : 0;
    void setCenter(
      node.position.x + width / 2 + offsetX,
      node.position.y + height / 2 + SCREEN_LIFT_PX / zoom,
      { zoom, duration },
    );
  }, [step, reducedMotion, setCenter, getNode]);

  return null;
}

/**
 * The wizard's living backdrop: the same synthetic pipeline the landing hero
 * uses, but with the camera flying to the node the current step configures
 * (that node glows as `active`). Non-interactive and aria-hidden — decoration
 * built from the real product component, never a fake illustration.
 */
export function SetupFlowBackdrop({ step }: { step: SetupStepId }) {
  const { nodes, edges } = useMemo(() => buildDemoFlow(), []);
  const dotColor = useFlowDotColor();
  const focusId = FOCUS_BY_STEP[step];

  const decoratedNodes = useMemo(
    () =>
      nodes.map((node) => ({
        ...node,
        draggable: false,
        connectable: false,
        data: { ...node.data, active: node.id === focusId },
      })),
    [nodes, focusId],
  );

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 opacity-35 [mask-image:radial-gradient(120%_75%_at_50%_45%,black_55%,transparent_92%)]"
    >
      <ReactFlow
        nodes={decoratedNodes}
        edges={edges}
        nodeTypes={pipelineNodeTypes}
        edgeTypes={pipelineEdgeTypes}
        minZoom={0.2}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        zoomOnScroll={false}
        panOnDrag={false}
        preventScrolling={false}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={18} size={1} color={dotColor} />
        <ViewportDirector step={step} />
      </ReactFlow>
    </div>
  );
}
