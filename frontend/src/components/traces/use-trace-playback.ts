import { useCallback, useEffect, useState } from "react";

import type { PipelineNodeRunTrace } from "@/lib/types";
import type { Node, ReactFlowInstance } from "@xyflow/react";

const PLAYBACK_INTERVAL_MS = 1400;

type UseTracePlaybackParams = {
  orderedRuns: PipelineNodeRunTrace[];
  flowInstance: ReactFlowInstance | null;
  baseNodes: Node[];
  resetPayloadToggles: () => void;
};

type UseTracePlaybackResult = {
  activeIndex: number;
  activeNodeId: string | undefined;
  isPlaying: boolean;
  togglePlaying: () => void;
  handleNodeClick: (event: unknown, node: Node) => void;
  handleStepForward: () => void;
};

/**
 * Owns trace playback state: which node run is active, whether autoplay is running,
 * and keeping the ReactFlow camera focused on the active node (plus its neighbors).
 */
export function useTracePlayback({
  orderedRuns,
  flowInstance,
  baseNodes,
  resetPayloadToggles,
}: UseTracePlaybackParams): UseTracePlaybackResult {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const activeNodeId = orderedRuns[activeIndex]?.node_id;

  useEffect(() => {
    if (!isPlaying || orderedRuns.length === 0) return;
    const timer = window.setInterval(() => {
      resetPayloadToggles();
      setActiveIndex((prev) => {
        const nextIndex = prev + 1;
        if (nextIndex >= orderedRuns.length) {
          setIsPlaying(false);
          return prev;
        }
        return nextIndex;
      });
    }, PLAYBACK_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [isPlaying, orderedRuns.length, resetPayloadToggles]);

  useEffect(() => {
    if (!flowInstance || !activeNodeId) return;
    const focusIds = new Set<string>();
    const previousNodeId = orderedRuns[activeIndex - 1]?.node_id;
    const nextNodeId = orderedRuns[activeIndex + 1]?.node_id;
    if (previousNodeId) focusIds.add(previousNodeId);
    focusIds.add(activeNodeId);
    if (nextNodeId) focusIds.add(nextNodeId);
    const focusNodes = baseNodes.filter((node) => focusIds.has(node.id));
    if (focusNodes.length) {
      flowInstance.fitView({ nodes: focusNodes, padding: 0.7, duration: 600 });
    }
  }, [flowInstance, activeNodeId, activeIndex, baseNodes, orderedRuns]);

  const togglePlaying = useCallback(() => setIsPlaying((prev) => !prev), []);

  const handleNodeClick = useCallback(
    (_event: unknown, node: Node) => {
      const index = orderedRuns.findIndex((run) => run.node_id === node.id);
      if (index >= 0) {
        resetPayloadToggles();
        setActiveIndex(index);
      }
    },
    [orderedRuns, resetPayloadToggles],
  );

  const handleStepForward = useCallback(() => {
    resetPayloadToggles();
    setActiveIndex((prev) => Math.min(prev + 1, orderedRuns.length - 1));
  }, [orderedRuns.length, resetPayloadToggles]);

  return {
    activeIndex,
    activeNodeId,
    isPlaying,
    togglePlaying,
    handleNodeClick,
    handleStepForward,
  };
}
