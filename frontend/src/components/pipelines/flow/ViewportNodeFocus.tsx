"use client";

import { useReactFlow, useStore } from "@xyflow/react";
import { useEffect } from "react";

/**
 * Pans and zooms the viewport to center one node whenever `nodeId` changes —
 * the camera half of a guided walkthrough. Subscribes to the node's live
 * measured geometry so a late measurement (fonts, first paint) re-centers
 * against real dimensions instead of a zero-height placeholder.
 */
export function ViewportNodeFocus({ nodeId }: Readonly<{ nodeId: string | null }>) {
  const { setCenter } = useReactFlow();
  const node = useStore((state) => (nodeId ? state.nodeLookup.get(nodeId) : undefined));
  const nodeX = node?.internals.positionAbsolute.x ?? 0;
  const nodeY = node?.internals.positionAbsolute.y ?? 0;
  const nodeWidth = node?.measured?.width ?? 0;
  const nodeHeight = node?.measured?.height ?? 0;

  useEffect(() => {
    if (!nodeId || nodeHeight === 0) return;
    void setCenter(nodeX + nodeWidth / 2, nodeY + nodeHeight / 2, {
      zoom: 0.85,
      duration: 500,
    });
  }, [nodeId, nodeX, nodeY, nodeWidth, nodeHeight, setCenter]);

  return null;
}
