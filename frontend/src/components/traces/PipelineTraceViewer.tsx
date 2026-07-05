"use client";

import { Background, Controls, ReactFlow, type Node, type ReactFlowInstance } from "@xyflow/react";
import { FileText, Pause, Play, StepForward, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { toFlowEdges, toFlowNodes } from "@/components/pipelines/pipeline-utils";
import { pipelineNodeTypes } from "@/components/pipelines/PipelineNode";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/panel";
import { fetchPipelineNodes } from "@/lib/api";
import { cn, prettyJson, truncate } from "@/lib/utils";

import type {
  NodeSpec,
  PipelineNodeIOTrace,
  PipelineNodeSummaryValue,
  PipelineTraceResponse,
} from "@/lib/types";

type PipelineTraceViewerProps = {
  trace: PipelineTraceResponse | null;
  token: string;
  isOpen: boolean;
  onClose: () => void;
  highlightChunkId?: string | null;
};

type IOGroup = {
  inputs: PipelineNodeIOTrace[];
  outputs: PipelineNodeIOTrace[];
};

const TRACE_CURSOR_ID = "trace-cursor";
const EMBEDDING_PREVIEW_COUNT = 12;
const NODE_WIDTH = 220;
const NODE_HEIGHT = 120;
const CURSOR_SIZE = 30;
const TEXT_PREVIEW_LIMIT = 240;

const buildFallbackPosition = (index: number) => ({
  x: 220 * (index % 3),
  y: 180 * Math.floor(index / 3),
});

const containsChunkId = (value: unknown, chunkId: string, depth = 0): boolean => {
  if (!chunkId || depth > 4) return false;
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) {
    if (value.length > 80 && value.every((entry) => typeof entry === "number")) {
      return false;
    }
    return value.slice(0, 120).some((entry) => containsChunkId(entry, chunkId, depth + 1));
  }
  const record = value as Record<string, unknown>;
  if (
    typeof record.chunk_id === "string" &&
    record.chunk_id.toLowerCase() === chunkId.toLowerCase()
  ) {
    return true;
  }
  if (
    typeof record.chunkId === "string" &&
    record.chunkId.toLowerCase() === chunkId.toLowerCase()
  ) {
    return true;
  }
  return Object.values(record).some((entry) => containsChunkId(entry, chunkId, depth + 1));
};

const buildPreviewPayload = (value: unknown, depth = 0): unknown => {
  if (depth > 4) return value;
  if (Array.isArray(value)) {
    const isNumeric = value.every((entry) => typeof entry === "number");
    if (isNumeric && value.length > EMBEDDING_PREVIEW_COUNT) {
      return {
        preview: value.slice(0, EMBEDDING_PREVIEW_COUNT),
        total_values: value.length,
      };
    }
    return value.slice(0, 40).map((entry) => buildPreviewPayload(entry, depth + 1));
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const preview: Record<string, unknown> = {};
    Object.entries(record).forEach(([key, entry]) => {
      preview[key] = buildPreviewPayload(entry, depth + 1);
    });
    return preview;
  }
  return value;
};

const TraceCursorNode = () => (
  <div className="flex h-8 w-8 items-center justify-center rounded-full border border-cyan-200/70 bg-cyan-500/20 text-cyan-100 shadow-lg">
    <FileText className="h-4 w-4" />
  </div>
);

const traceNodeTypes = {
  pipelineNode: pipelineNodeTypes.pipelineNode,
  traceCursor: TraceCursorNode,
};

const resolveNodeSize = (node: Node) => ({
  width: node.width ?? NODE_WIDTH,
  height: node.height ?? NODE_HEIGHT,
});

const getNodeAnchor = (node: Node, position: "source" | "target") => {
  const { width, height } = resolveNodeSize(node);
  return {
    x: node.position.x + width / 2,
    y: node.position.y + (position === "source" ? height : 0),
  };
};

const getNodeCenter = (node: Node) => {
  const { width, height } = resolveNodeSize(node);
  return {
    x: node.position.x + width / 2,
    y: node.position.y + height / 2,
  };
};

const buildCursorNode = (position?: { x: number; y: number }): Node | null => {
  if (!position) return null;
  return {
    id: TRACE_CURSOR_ID,
    type: "traceCursor",
    position: {
      x: position.x - CURSOR_SIZE / 2,
      y: position.y - CURSOR_SIZE / 2,
    },
    draggable: false,
    selectable: false,
    focusable: false,
    data: {},
    style: { transition: "transform 0.9s ease", zIndex: 30 },
  };
};

const formatPayload = (payload: unknown, expanded: boolean) =>
  expanded ? prettyJson(payload) : prettyJson(buildPreviewPayload(payload));

const resolveTextSummary = (value: unknown) => {
  if (typeof value === "string") {
    return { preview: truncate(value, TEXT_PREVIEW_LIMIT), length: value.length, full: value };
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (typeof record.preview === "string") {
      const length = typeof record.length === "number" ? record.length : record.preview.length;
      const full = typeof record.full === "string" ? record.full : undefined;
      return { preview: record.preview, length, full };
    }
  }
  return null;
};

const renderScalarValue = (value: unknown, expanded: boolean) => {
  if (value == null) return "—";
  if (typeof value === "string") {
    return expanded ? value : truncate(value, TEXT_PREVIEW_LIMIT);
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return null;
};

const SummaryBlock = ({
  item,
  highlight,
}: {
  item: PipelineNodeSummaryValue;
  highlight: boolean;
}) => {
  const [expanded, setExpanded] = useState(false);
  const textSummary = item.kind === "text" ? resolveTextSummary(item.value) : null;
  const scalarValue = textSummary ? null : renderScalarValue(item.value, expanded);
  const showToggle =
    Boolean(textSummary?.full && textSummary.full.length > textSummary.preview.length) ||
    (scalarValue === null && item.value !== undefined);
  const embeddingStats =
    item.kind === "embedding" && item.value && typeof item.value === "object"
      ? (item.value as Record<string, unknown>)
      : null;

  return (
    <div
      className={cn(
        "rounded-2xl border border-white/10 bg-black/30 p-3 text-xs text-slate-200",
        highlight && "border-cyan-400/70 bg-cyan-500/10",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] uppercase tracking-[0.3em] text-slate-300">{item.label}</p>
        {showToggle && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded((prev) => !prev)}
            className="text-[10px] uppercase tracking-[0.3em]"
          >
            {expanded ? "Collapse" : "Expand"}
          </Button>
        )}
      </div>
      {textSummary ? (
        <div className="mt-3 space-y-2">
          <p className="whitespace-pre-wrap text-xs text-slate-100">
            {expanded && textSummary.full ? textSummary.full : textSummary.preview}
          </p>
          <p className="text-[10px] uppercase tracking-[0.3em] text-slate-400">
            length {textSummary.length}
          </p>
        </div>
      ) : scalarValue !== null ? (
        <p className="mt-3 whitespace-pre-wrap text-xs text-slate-100">{scalarValue}</p>
      ) : (
        <div className="mt-3 space-y-2">
          {embeddingStats && (
            <div className="flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.3em] text-slate-400">
              {"count" in embeddingStats && (
                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1">
                  count {embeddingStats.count as number}
                </span>
              )}
              {"dimension" in embeddingStats && (
                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1">
                  dimension {embeddingStats.dimension as number}
                </span>
              )}
            </div>
          )}
          <pre className="max-h-56 overflow-auto rounded-xl bg-black/40 p-3 text-[11px] text-slate-100">
            {formatPayload(item.value, expanded)}
          </pre>
        </div>
      )}
    </div>
  );
};

const PayloadBlock = ({ payload, highlight }: { payload: unknown; highlight: boolean }) => {
  const [expanded, setExpanded] = useState(false);
  return (
    <div
      className={cn(
        "rounded-2xl border border-white/10 bg-black/30 p-3 text-xs text-slate-200",
        highlight && "border-cyan-400/70 bg-cyan-500/10",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] uppercase tracking-[0.3em] text-slate-300">
          {expanded ? "Full payload" : "Preview"}
        </p>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setExpanded((prev) => !prev)}
          className="text-[10px] uppercase tracking-[0.3em]"
        >
          {expanded ? "Collapse" : "Expand"}
        </Button>
      </div>
      <pre className="mt-3 max-h-56 overflow-auto rounded-xl bg-black/40 p-3 text-[11px] text-slate-100">
        {formatPayload(payload, expanded)}
      </pre>
    </div>
  );
};

export function PipelineTraceViewer({
  trace,
  token,
  isOpen,
  onClose,
  highlightChunkId,
}: PipelineTraceViewerProps) {
  const [nodeSpecs, setNodeSpecs] = useState<NodeSpec[]>([]);
  const [specsLoaded, setSpecsLoaded] = useState(false);
  const [nodeSpecsError, setNodeSpecsError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [flowInstance, setFlowInstance] = useState<ReactFlowInstance | null>(null);
  const [showInputPayloads, setShowInputPayloads] = useState(false);
  const [showOutputPayloads, setShowOutputPayloads] = useState(false);
  const resetPayloadToggles = useCallback(() => {
    setShowInputPayloads(false);
    setShowOutputPayloads(false);
  }, []);

  useEffect(() => {
    if (!isOpen || specsLoaded) return;
    let cancelled = false;
    fetchPipelineNodes(token)
      .then((specs) => {
        if (!cancelled) {
          setNodeSpecs(specs);
          setSpecsLoaded(true);
          setNodeSpecsError(null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSpecsLoaded(true);
          setNodeSpecsError(
            "Node details are unavailable right now; showing the trace without them.",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, specsLoaded, token]);

  const orderedRuns = useMemo(
    () => (trace ? [...trace.node_runs].sort((a, b) => a.sequence_index - b.sequence_index) : []),
    [trace],
  );

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
    }, 1400);
    return () => window.clearInterval(timer);
  }, [isPlaying, orderedRuns.length, resetPayloadToggles]);

  const activeEdge = useMemo(() => {
    if (!trace || !activeNodeId) return null;
    const nextNodeId = orderedRuns[activeIndex + 1]?.node_id;
    if (nextNodeId) {
      return (
        trace.definition.edges.find(
          (edge) => edge.source === activeNodeId && edge.target === nextNodeId,
        ) ?? null
      );
    }
    const previousNodeId = orderedRuns[activeIndex - 1]?.node_id;
    if (previousNodeId) {
      return (
        trace.definition.edges.find(
          (edge) => edge.source === previousNodeId && edge.target === activeNodeId,
        ) ?? null
      );
    }
    return null;
  }, [trace, activeNodeId, orderedRuns, activeIndex]);

  const activeEdgeIds = useMemo(() => {
    if (!activeEdge) return new Set<string>();
    return new Set([activeEdge.id]);
  }, [activeEdge]);

  const baseNodes = useMemo(() => {
    if (!trace) return [];
    const nodes = trace.definition.nodes.map((node, index) => ({
      ...node,
      position: node.position ?? buildFallbackPosition(index),
    }));
    const definition = { ...trace.definition, nodes };
    const flowNodes = toFlowNodes(definition, nodeSpecs);
    const runMap = new Map(orderedRuns.map((run) => [run.node_id, run]));
    return flowNodes.map((node) => ({
      ...node,
      data: {
        ...node.data,
        status: runMap.get(node.id)?.status,
        active: node.id === activeNodeId,
      },
    }));
  }, [trace, nodeSpecs, orderedRuns, activeNodeId]);

  const edges = useMemo(() => {
    if (!trace) return [];
    return toFlowEdges(trace.definition).map((edge) => ({
      ...edge,
      animated: activeEdgeIds.has(edge.id),
      style: {
        stroke: activeEdgeIds.has(edge.id) ? "#38bdf8" : "#334155",
        strokeWidth: activeEdgeIds.has(edge.id) ? 2.5 : 1.25,
      },
    }));
  }, [trace, activeEdgeIds]);

  const cursorPosition = useMemo(() => {
    if (!activeNodeId) return null;
    if (activeEdge) {
      const sourceNode = baseNodes.find((entry) => entry.id === activeEdge.source);
      const targetNode = baseNodes.find((entry) => entry.id === activeEdge.target);
      if (sourceNode && targetNode) {
        const sourceAnchor = getNodeAnchor(sourceNode, "source");
        const targetAnchor = getNodeAnchor(targetNode, "target");
        return {
          x: (sourceAnchor.x + targetAnchor.x) / 2,
          y: (sourceAnchor.y + targetAnchor.y) / 2,
        };
      }
    }
    const fallbackNode = baseNodes.find((entry) => entry.id === activeNodeId);
    return fallbackNode ? getNodeCenter(fallbackNode) : null;
  }, [activeNodeId, activeEdge, baseNodes]);

  const cursorNode = useMemo(() => buildCursorNode(cursorPosition ?? undefined), [cursorPosition]);

  const nodes = useMemo(() => {
    if (!cursorNode) return baseNodes;
    return [...baseNodes, cursorNode];
  }, [baseNodes, cursorNode]);

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

  const ioByNode = useMemo(() => {
    const grouped = new Map<string, IOGroup>();
    if (!trace) return grouped;
    trace.node_io.forEach((record) => {
      const entry = grouped.get(record.node_id) ?? { inputs: [], outputs: [] };
      if (record.io_type === "input") {
        entry.inputs.push(record);
      } else {
        entry.outputs.push(record);
      }
      grouped.set(record.node_id, entry);
    });
    return grouped;
  }, [trace]);

  const selectedIO = activeNodeId ? ioByNode.get(activeNodeId) : undefined;
  const activeSummary = orderedRuns[activeIndex]?.summary ?? { inputs: [], outputs: [] };

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

  if (!isOpen || !trace) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm">
      <div className="relative h-full w-full max-w-6xl overflow-hidden rounded-[32px] border border-white/10 bg-slate-950/95 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Pipeline trace</p>
            <h2 className="text-xl font-semibold text-white">
              {trace.run.status.toUpperCase()} trace
            </h2>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="gap-2">
            <X className="h-4 w-4" />
            Close
          </Button>
        </div>

        <div className="flex h-[calc(100%-64px)] flex-col gap-4 overflow-y-auto p-6">
          {nodeSpecsError && (
            <div className="rounded-2xl border border-amber-400/40 bg-amber-500/10 px-4 py-2 text-xs text-amber-100">
              {nodeSpecsError}
            </div>
          )}
          <GlassCard className="relative min-h-[420px] overflow-hidden rounded-3xl border border-white/10 bg-slate-950/80">
            <div className="absolute left-4 top-4 z-10 flex items-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setIsPlaying((prev) => !prev)}
                className="flex items-center gap-2"
              >
                {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                {isPlaying ? "Pause trace" : "Play trace"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleStepForward}
                className="flex items-center gap-2"
              >
                <StepForward className="h-4 w-4" />
                Step
              </Button>
            </div>
            {highlightChunkId && (
              <div className="absolute right-4 top-4 z-10 rounded-full border border-cyan-400/40 bg-cyan-500/10 px-3 py-1 text-[10px] uppercase tracking-[0.3em] text-cyan-200">
                chunk {highlightChunkId}
              </div>
            )}
            <div className="h-full min-h-[420px]">
              <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={traceNodeTypes}
                onNodeClick={handleNodeClick}
                onInit={setFlowInstance}
                fitView
                proOptions={{ hideAttribution: true }}
              >
                <Background gap={18} size={1} color="#1f2937" />
                <Controls className="pipeline-controls" />
              </ReactFlow>
            </div>
          </GlassCard>

          <div className="rounded-3xl border border-white/10 bg-slate-950/60 p-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Active node</p>
                <h3 className="text-lg font-semibold text-white">
                  {orderedRuns[activeIndex]?.node_name || activeNodeId || "—"}
                </h3>
              </div>
              {orderedRuns[activeIndex] && (
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] uppercase tracking-[0.3em] text-slate-300">
                  {orderedRuns[activeIndex]?.status}
                </span>
              )}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-3xl border border-cyan-400/30 bg-cyan-500/10 p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs uppercase tracking-[0.35em] text-cyan-200">Inputs</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowInputPayloads((prev) => !prev)}
                  className="text-[10px] uppercase tracking-[0.3em] text-cyan-100"
                >
                  {showInputPayloads ? "Hide full payloads" : "Show full payloads"}
                </Button>
              </div>
              <div className="mt-3 space-y-3">
                {activeSummary.inputs.length ? (
                  activeSummary.inputs.map((item, index) => (
                    <SummaryBlock
                      key={`${item.label}-${index}`}
                      item={item}
                      highlight={
                        Boolean(highlightChunkId) &&
                        containsChunkId(item.value, highlightChunkId ?? "")
                      }
                    />
                  ))
                ) : (
                  <p className="text-xs text-slate-400">No primary inputs recorded.</p>
                )}
              </div>
              {showInputPayloads && (
                <div className="mt-4 border-t border-white/10 pt-4">
                  <p className="text-[10px] uppercase tracking-[0.3em] text-slate-300">
                    Full payloads
                  </p>
                  <div className="mt-3 space-y-3">
                    {selectedIO?.inputs?.length ? (
                      selectedIO.inputs.map((record) => (
                        <div key={`${record.id}-${record.port}`} className="space-y-2">
                          <p className="text-[10px] uppercase tracking-[0.3em] text-slate-300">
                            {record.port}
                          </p>
                          <PayloadBlock
                            payload={record.payload}
                            highlight={
                              Boolean(highlightChunkId) &&
                              containsChunkId(record.payload, highlightChunkId ?? "")
                            }
                          />
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-slate-400">No inputs recorded.</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-3xl border border-violet-400/30 bg-violet-500/10 p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs uppercase tracking-[0.35em] text-violet-200">Outputs</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowOutputPayloads((prev) => !prev)}
                  className="text-[10px] uppercase tracking-[0.3em] text-violet-100"
                >
                  {showOutputPayloads ? "Hide full payloads" : "Show full payloads"}
                </Button>
              </div>
              <div className="mt-3 space-y-3">
                {activeSummary.outputs.length ? (
                  activeSummary.outputs.map((item, index) => (
                    <SummaryBlock
                      key={`${item.label}-${index}`}
                      item={item}
                      highlight={
                        Boolean(highlightChunkId) &&
                        containsChunkId(item.value, highlightChunkId ?? "")
                      }
                    />
                  ))
                ) : (
                  <p className="text-xs text-slate-400">No primary outputs recorded.</p>
                )}
              </div>
              {showOutputPayloads && (
                <div className="mt-4 border-t border-white/10 pt-4">
                  <p className="text-[10px] uppercase tracking-[0.3em] text-slate-300">
                    Full payloads
                  </p>
                  <div className="mt-3 space-y-3">
                    {selectedIO?.outputs?.length ? (
                      selectedIO.outputs.map((record) => (
                        <div key={`${record.id}-${record.port}`} className="space-y-2">
                          <p className="text-[10px] uppercase tracking-[0.3em] text-slate-300">
                            {record.port}
                          </p>
                          <PayloadBlock
                            payload={record.payload}
                            highlight={
                              Boolean(highlightChunkId) &&
                              containsChunkId(record.payload, highlightChunkId ?? "")
                            }
                          />
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-slate-400">No outputs recorded.</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
