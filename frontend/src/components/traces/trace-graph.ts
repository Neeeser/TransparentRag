import { layoutPipelineNodes, needsAutoLayout } from "@/components/pipelines/lib/pipeline-layout";
import { toFlowEdges, toFlowNodes } from "@/components/pipelines/lib/pipeline-utils";

import type { TypedEdgeType } from "@/components/pipelines/flow/TypedEdge";
import type { PipelineNodeData } from "@/components/pipelines/PipelineNode";
import type {
  NodeSpec,
  PipelineNodeIOTrace,
  PipelineNodeRunTrace,
  PipelineTraceResponse,
} from "@/lib/types";
import type { Node } from "@xyflow/react";

export type TraceIOGroup = {
  inputs: PipelineNodeIOTrace[];
  outputs: PipelineNodeIOTrace[];
};

export type TraceStage = "origin" | "retrieval";

/** One playback step: the visited node plus its resolved run and IO records. */
export type TraceStep = {
  nodeId: string;
  run: PipelineNodeRunTrace | null;
  io: TraceIOGroup;
  stage: TraceStage;
  stageLabel: string;
};

export type TraceGraph = {
  nodes: Node<PipelineNodeData>[];
  edges: TypedEdgeType[];
  steps: TraceStep[];
  /** True when the graph joins an origin ingestion run to the retrieval run. */
  combined: boolean;
};

const groupIO = (records: PipelineNodeIOTrace[]): Map<string, TraceIOGroup> => {
  const grouped = new Map<string, TraceIOGroup>();
  records.forEach((record) => {
    const entry = grouped.get(record.node_id) ?? { inputs: [], outputs: [] };
    if (record.io_type === "input") entry.inputs.push(record);
    else entry.outputs.push(record);
    grouped.set(record.node_id, entry);
  });
  return grouped;
};

type StageGraph = {
  nodes: Node<PipelineNodeData>[];
  edges: TypedEdgeType[];
  steps: TraceStep[];
};

/** Build one stage's laid-out graph and ordered steps from a single trace. */
const buildStage = (
  trace: PipelineTraceResponse,
  nodeSpecs: NodeSpec[],
  stage: TraceStage,
  stageLabel: string,
  forceLayout = false,
): StageGraph => {
  const orderedRuns = [...trace.node_runs].sort((a, b) => a.sequence_index - b.sequence_index);
  const runByNode = new Map(orderedRuns.map((run) => [run.node_id, run]));
  const ioByNode = groupIO(trace.node_io);

  let nodes: Node<PipelineNodeData>[] = toFlowNodes(trace.definition, nodeSpecs).map((node) => ({
    ...node,
    data: { ...node.data, status: runByNode.get(node.id)?.status },
  }));
  const edges = toFlowEdges(trace.definition, nodeSpecs);
  // A trace is a read-only narrative: when joining two runs into stacked
  // bands, always re-lay-out each band so it reads cleanly regardless of the
  // saved editor positions (which are for editing, not storytelling).
  if (forceLayout || needsAutoLayout(nodes)) {
    nodes = layoutPipelineNodes(nodes, edges);
  }

  const steps: TraceStep[] = orderedRuns.map((run) => ({
    nodeId: run.node_id,
    run,
    io: ioByNode.get(run.node_id) ?? { inputs: [], outputs: [] },
    stage,
    stageLabel,
  }));

  return { nodes, edges, steps };
};

const PREFIX_ORIGIN = "origin::";
const PREFIX_RETRIEVAL = "retrieval::";
const BAND_GAP_Y = 200;

const prefixStage = (graph: StageGraph, prefix: string): StageGraph => ({
  nodes: graph.nodes.map((node) => ({ ...node, id: `${prefix}${node.id}` })),
  edges: graph.edges.map((edge) => ({
    ...edge,
    id: `${prefix}${edge.id}`,
    source: `${prefix}${edge.source}`,
    target: `${prefix}${edge.target}`,
  })),
  steps: graph.steps.map((step) => ({ ...step, nodeId: `${prefix}${step.nodeId}` })),
});

const bandBottom = (nodes: Node<PipelineNodeData>[]): number =>
  nodes.reduce((max, node) => Math.max(max, node.position.y), 0);

const offsetY = (graph: StageGraph, dy: number): StageGraph => ({
  ...graph,
  nodes: graph.nodes.map((node) => ({
    ...node,
    position: { x: node.position.x, y: node.position.y + dy },
  })),
});

/** The indexer node in an ingestion graph / retriever node in a retrieval graph. */
const findByPrefix = (nodes: Node<PipelineNodeData>[], typePrefix: string) =>
  nodes.find((node) => node.data.nodeType.startsWith(typePrefix));

/**
 * Build the playback graph for a trace. With `origin`, ingestion and retrieval
 * are laid out as two stacked bands joined by a dashed hand-off wire through
 * the shared index, and the steps run ingestion-first then retrieval — so a
 * chunk can be followed from the document it came from all the way to the
 * query that surfaced it. Without `origin`, it's just the retrieval graph.
 */
export const buildTraceGraph = (
  retrieval: PipelineTraceResponse,
  origin: PipelineTraceResponse | null,
  nodeSpecs: NodeSpec[],
): TraceGraph => {
  if (!origin) {
    const stage = buildStage(retrieval, nodeSpecs, "retrieval", "Retrieval");
    return { ...stage, combined: false };
  }

  const originStage = prefixStage(
    buildStage(origin, nodeSpecs, "origin", "Ingestion · origin", true),
    PREFIX_ORIGIN,
  );
  const retrievalRaw = prefixStage(
    buildStage(retrieval, nodeSpecs, "retrieval", "Retrieval", true),
    PREFIX_RETRIEVAL,
  );
  const retrievalStage = offsetY(retrievalRaw, bandBottom(originStage.nodes) + BAND_GAP_Y);

  const edges: TypedEdgeType[] = [...originStage.edges, ...retrievalStage.edges];
  const indexer = findByPrefix(originStage.nodes, "indexer.");
  const retriever = findByPrefix(retrievalStage.nodes, "retriever.");
  if (indexer && retriever) {
    edges.push({
      id: "handoff::index",
      source: indexer.id,
      target: retriever.id,
      type: "typed",
      data: { dataType: "indexed_batch", visited: true },
      // The chunk rests in the shared index between the two runs; a dashed
      // wire marks that hand-off rather than a live payload edge.
      style: { strokeDasharray: "6 5" },
    });
  }

  return {
    nodes: [...originStage.nodes, ...retrievalStage.nodes],
    edges,
    steps: [...originStage.steps, ...retrievalStage.steps],
    combined: true,
  };
};
