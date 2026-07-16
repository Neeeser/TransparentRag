import type { PipelineNodeData } from "@/components/pipelines/PipelineNode";
import type { JourneyStep } from "@/components/traces/lib/journey";
import type { TraceStep } from "@/components/traces/trace-graph";
import type { TraceFocusedItem } from "@/lib/types";
import type { Node } from "@xyflow/react";

export type NodeExplanationProps = {
  step: TraceStep;
  node: Node<PipelineNodeData>;
  focusedItemId: string | null;
  contextItems: TraceFocusedItem[];
  itemEffect: JourneyStep | null;
  inputSources: string[];
  onFocusItem?: (itemId: string) => void;
  onOpenArtifact?: (item: TraceFocusedItem) => void;
};
