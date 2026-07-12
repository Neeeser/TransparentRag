import type { TypedEdgeType } from "@/components/pipelines/flow/TypedEdge";
import type { FlowStep } from "@/components/pipelines/flow/use-flow-playback";
import type { PipelineNodeData } from "@/components/pipelines/PipelineNode";
import type { NodePort } from "@/lib/types";
import type { Node } from "@xyflow/react";

/**
 * Builder for the landing page's *synthetic* pipeline scenes — hand-authored
 * graphs built entirely in memory (no telemetry, no traces, no network) so
 * they render on the unauthenticated public page. The visualization itself is
 * the real product component (`FlowPlayer`), fed nodes/edges/steps in the
 * same shape the trace viewer produces. Scene content lives in `scenes.ts`;
 * this module only turns a `SceneDefinition` into renderable flow data.
 */

export type DemoPort = { key: string; label: string; dataType: string };

export type DemoNode = {
  id: string;
  /** Prefix (before the dot) drives the node's color family in PipelineNode. */
  nodeType: string;
  label: string;
  description: string;
  input?: DemoPort;
  output?: DemoPort;
  /**
   * Fake-but-plausible config rendered on the card's signature readout
   * (model name, index name, chunk size) so no node shows an unset
   * "no model selected" placeholder.
   */
  config?: Record<string, unknown>;
  /** Grid column (left-to-right pipeline order). */
  col: number;
  /**
   * Grid row: 0 is the main path, 1 the parallel branch below it. Fractional
   * rows (0.5) center a merge node between the branches so its inbound wires
   * approach from above and below instead of hiding behind a card.
   */
  row?: number;
};

export type SceneDefinition = {
  nodes: DemoNode[];
  /** Wires as `[sourceId, targetId]`; handles/color derive from the node ports. */
  edges: [string, string][];
  /**
   * Playback stages, in order. Each stage's nodes glow together, and every
   * edge from stage N into stage N+1 travels simultaneously — list a branch
   * node in consecutive stages to hold its glow while the other branch
   * catches up before a merge.
   */
  stages: string[][];
};

/** Matches the pipeline editor's scaffold spacing so the graph reads familiarly. */
const NODE_SPACING_X = 368;
/**
 * Vertical drop of the parallel branch row — wide enough that a wire crossing
 * under a main-row card clears the card's bottom edge instead of hiding
 * behind it.
 */
const NODE_SPACING_Y = 250;

const toPort = (port: DemoPort): NodePort => ({
  key: port.key,
  label: port.label,
  data_type: port.dataType,
  required: true,
  accepts_many: false,
});

export type DemoFlow = {
  nodes: Node<PipelineNodeData>[];
  edges: TypedEdgeType[];
  steps: FlowStep[];
};

/** Turn a hand-authored scene definition into renderable flow data. Pure. */
export function buildSceneFlow(scene: SceneDefinition): DemoFlow {
  const byId = new Map(scene.nodes.map((node) => [node.id, node]));

  const nodes: Node<PipelineNodeData>[] = scene.nodes.map((node) => ({
    id: node.id,
    type: "pipelineNode",
    position: { x: NODE_SPACING_X * node.col, y: NODE_SPACING_Y * (node.row ?? 0) },
    data: {
      label: node.label,
      nodeType: node.nodeType,
      description: node.description,
      inputs: node.input ? [toPort(node.input)] : [],
      outputs: node.output ? [toPort(node.output)] : [],
      config: node.config ?? {},
    },
  }));

  const edges: TypedEdgeType[] = scene.edges.map(([sourceId, targetId]) => {
    const source = byId.get(sourceId);
    const target = byId.get(targetId);
    if (!source?.output || !target?.input) {
      throw new Error(`Scene edge ${sourceId} → ${targetId} references missing ports.`);
    }
    return {
      id: `${sourceId}-${targetId}`,
      source: sourceId,
      target: targetId,
      sourceHandle: source.output.key,
      targetHandle: target.input.key,
      type: "typed",
      // Wire color comes from the upstream output port, as toFlowEdges does.
      data: { dataType: source.output.dataType },
    };
  });

  const steps: FlowStep[] = scene.stages.map((nodeIds) => ({ nodeIds }));

  return { nodes, edges, steps };
}
