"use client";

import { SmartEdgeBatchRoutingProvider } from "@tisoap/react-flow-smart-edge";
import { useState } from "react";

import { resolveNodeDimensions } from "../lib/pipeline-layout";

import type { PipelineNodeData } from "../PipelineNode";
import type { SmartEdgeBatchOptions } from "@tisoap/react-flow-smart-edge";
import type { Node } from "@xyflow/react";
import type { ReactNode } from "react";

export const PIPELINE_EDGE_ROUTING_OPTIONS = {
  preset: "smoothstep",
  gridRatio: 10,
  nodePadding: 16,
  borderRadius: 6,
} satisfies SmartEdgeBatchOptions;

type PipelineNode = Node<PipelineNodeData>;

const geometrySignature = (nodes: PipelineNode[]) =>
  nodes
    .map((node) => {
      const { width, height } = resolveNodeDimensions(node);
      return [node.id, node.position.x, node.position.y, width, height, node.parentId ?? ""].join(
        ":",
      );
    })
    .join("|");

const makeSnapshot = (nodes: PipelineNode[]) => ({
  signature: geometrySignature(nodes),
  nodes: nodes.map((node) => ({
    id: node.id,
    position: node.position,
    measured: resolveNodeDimensions(node),
    parentId: node.parentId,
    data: {},
  })),
});

/**
 * Batches every visible edge into one worker request. The projected node array
 * changes only when obstacle geometry changes, so status/style updates do not
 * invalidate all routes.
 */
export function PipelineEdgeRoutingProvider({
  nodes,
  children,
}: Readonly<{ nodes: PipelineNode[]; children: ReactNode }>) {
  const [snapshot, setSnapshot] = useState(() => makeSnapshot(nodes));
  const signature = geometrySignature(nodes);
  let current = snapshot;
  if (signature !== snapshot.signature) {
    current = makeSnapshot(nodes);
    setSnapshot(current);
  }

  return (
    <SmartEdgeBatchRoutingProvider nodes={current.nodes} options={PIPELINE_EDGE_ROUTING_OPTIONS}>
      {children}
    </SmartEdgeBatchRoutingProvider>
  );
}
