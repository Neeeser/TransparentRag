"use client";

import { Background, ReactFlow } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Pause, Play, RotateCcw, SkipBack, SkipForward } from "lucide-react";
import { useEffect, useMemo } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { pipelineNodeTypes } from "../PipelineNode";

import { pipelineEdgeTypes } from "./TypedEdge";
import { useFlowDotColor } from "./use-flow-dot-color";
import { useFlowPlayback } from "./use-flow-playback";

import type { PipelineNodeData } from "../PipelineNode";
import type { TypedEdgeType } from "./TypedEdge";
import type { FlowStep } from "./use-flow-playback";
import type { Node, NodeTypes } from "@xyflow/react";

type FlowPlayerProps = {
  nodes: Node<PipelineNodeData>[];
  edges: TypedEdgeType[];
  /** Node visits in execution order; empty renders a static (non-playing) graph. */
  steps: FlowStep[];
  autoPlay?: boolean;
  onActiveStepChange?: (index: number) => void;
  className?: string;
  /** Compact hides the step scrubber (landing-page style ambient playback). */
  compact?: boolean;
  /**
   * Ambient mode: an always-looping, non-interactive backdrop. Hides all
   * controls, disables clicks/pans, and restarts playback at the end. Used
   * for the landing-page hero flow.
   */
  ambient?: boolean;
  /** Extra node types merged over the pipeline defaults (e.g. the trace index store). */
  nodeTypes?: NodeTypes;
};

/**
 * Read-only pipeline graph with synchronized playback: the active node glows
 * while it "processes", then a payload dot rides the actual edge path to the
 * next node. The camera fits the whole graph once and stays put -- pipelines
 * are small enough that panning per step is disorienting, not helpful.
 */
export function FlowPlayer({
  nodes,
  edges,
  steps,
  autoPlay = false,
  onActiveStepChange,
  className,
  compact = false,
  ambient = false,
  nodeTypes,
}: FlowPlayerProps) {
  const playback = useFlowPlayback({ steps, edges, autoPlay, loop: ambient });
  const { activeIndex } = playback;
  const dotColor = useFlowDotColor();

  const mergedNodeTypes = useMemo(
    () => (nodeTypes ? { ...pipelineNodeTypes, ...nodeTypes } : pipelineNodeTypes),
    [nodeTypes],
  );

  useEffect(() => {
    onActiveStepChange?.(activeIndex);
  }, [activeIndex, onActiveStepChange]);

  const activeNodeId = steps[activeIndex]?.nodeId;

  const stepIndexByNodeId = useMemo(() => {
    const map = new Map<string, number>();
    steps.forEach((step, index) => {
      if (!map.has(step.nodeId)) map.set(step.nodeId, index);
    });
    return map;
  }, [steps]);

  const decoratedNodes = useMemo(
    () =>
      nodes.map((node) => ({
        ...node,
        draggable: false,
        connectable: false,
        // Nodes that map to a step are clickable to jump there; others (e.g.
        // the shared-index datastore) keep the default cursor.
        className: stepIndexByNodeId.has(node.id) ? "cursor-pointer" : undefined,
        data: { ...node.data, active: steps.length > 0 && node.id === activeNodeId },
      })),
    [nodes, activeNodeId, steps.length, stepIndexByNodeId],
  );

  const decoratedEdges = useMemo(
    () =>
      edges.map((edge) => {
        // The dot's <g> unmounts whenever `traveling` flips off, so each travel
        // phase remounts it and animateMotion restarts from the edge's start.
        const traveling = playback.travelingEdgeId === edge.id;
        return {
          ...edge,
          data: {
            ...edge.data,
            active: traveling,
            traveling,
            travelMs: playback.travelMs,
            visited: playback.visitedEdgeIds.has(edge.id),
          },
        };
      }),
    [edges, playback.travelingEdgeId, playback.visitedEdgeIds, playback.travelMs],
  );

  return (
    <div
      className={cn("relative h-full w-full", ambient && "pointer-events-none", className)}
      aria-hidden={ambient || undefined}
    >
      <ReactFlow
        nodes={decoratedNodes}
        edges={decoratedEdges}
        nodeTypes={mergedNodeTypes}
        edgeTypes={pipelineEdgeTypes}
        onNodeClick={
          ambient
            ? undefined
            : (_event, node) => {
                const index = stepIndexByNodeId.get(node.id);
                if (index !== undefined) playback.seek(index);
              }
        }
        fitView
        fitViewOptions={{ padding: 0.18, maxZoom: 1 }}
        minZoom={0.2}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        zoomOnScroll={false}
        panOnDrag={!compact && !ambient}
        preventScrolling={false}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={18} size={1} color={dotColor} />
      </ReactFlow>

      {steps.length > 0 && !ambient ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-3 z-10 flex justify-center">
          <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-hairline bg-canvas-raised/90 px-2 py-1.5 shadow-elevation-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={playback.stepBack}
              disabled={activeIndex === 0}
              aria-label="Previous step"
              className="flex h-7 w-7 items-center justify-center p-0"
            >
              <SkipBack className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={playback.toggle}
              aria-label={playback.playing ? "Pause playback" : "Play pipeline"}
              className="flex h-7 w-7 items-center justify-center p-0"
            >
              {playback.playing ? (
                <Pause className="h-3.5 w-3.5" />
              ) : (
                <Play className="h-3.5 w-3.5" />
              )}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={playback.stepForward}
              disabled={activeIndex >= steps.length - 1}
              aria-label="Next step"
              className="flex h-7 w-7 items-center justify-center p-0"
            >
              <SkipForward className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={playback.restart}
              aria-label="Restart playback"
              className="flex h-7 w-7 items-center justify-center p-0"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
            {!compact ? (
              <div
                className="ml-1 flex items-center gap-1 pr-1"
                role="tablist"
                aria-label="Pipeline steps"
              >
                {steps.map((step, index) => {
                  const node = nodes.find((entry) => entry.id === step.nodeId);
                  return (
                    <button
                      key={`${step.nodeId}-${index}`}
                      type="button"
                      role="tab"
                      aria-selected={index === activeIndex}
                      aria-label={node?.data.label ?? step.nodeId}
                      title={node?.data.label ?? step.nodeId}
                      onClick={() => playback.seek(index)}
                      className={cn(
                        "h-2 rounded-full transition-all",
                        index === activeIndex
                          ? "w-5 bg-accent-cyan"
                          : index < activeIndex
                            ? "w-2 bg-accent-cyan/50 hover:bg-accent-cyan/70"
                            : "w-2 bg-strong hover:brightness-150",
                      )}
                    />
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
