import { buildJourney } from "@/components/traces/lib/journey";

import type { JourneyStep } from "@/components/traces/lib/journey";
import type { TraceGraph, TraceStage, TraceStep } from "@/components/traces/trace-graph";

export type ExecutionEntry = {
  nodeId: string;
  index: number;
  step: TraceStep;
  itemEffect: JourneyStep | null;
};

export type ExecutionSection = {
  stage: TraceStage;
  label: string;
  entries: ExecutionEntry[];
};

/**
 * Build the complete node-run ledger. Focused item effects annotate matching
 * rows but never decide which executed nodes are present.
 */
export function buildExecutionSections(
  graph: TraceGraph,
  focusedItemId: string | null,
): ExecutionSection[] {
  const itemEffects = new Map(
    buildJourney(graph, focusedItemId).map((effect) => [effect.nodeId, effect]),
  );
  const sections: ExecutionSection[] = [];

  graph.steps.forEach((step, index) => {
    let section = sections.at(-1);
    if (!section || section.stage !== step.stage) {
      section = { stage: step.stage, label: step.stageLabel, entries: [] };
      sections.push(section);
    }
    section.entries.push({
      nodeId: step.nodeId,
      index,
      step,
      itemEffect: itemEffects.get(step.nodeId) ?? null,
    });
  });

  return sections;
}

/** Pick the evidence pane's initial node without coupling it to playback. */
export function initialExecutionNodeId(graph: TraceGraph, focused: boolean): string | null {
  const failed = graph.steps.find((step) => step.run?.status === "failed");
  if (failed) return failed.nodeId;
  if (focused) {
    const retrievalInput = graph.steps.find((step) => step.stage === "retrieval");
    if (retrievalInput) return retrievalInput.nodeId;
  }
  return graph.steps[0]?.nodeId ?? null;
}
