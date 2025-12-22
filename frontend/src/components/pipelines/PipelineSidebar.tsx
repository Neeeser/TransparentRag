"use client";

import { GlassCard } from "@/components/ui/panel";

import { PipelineCatalog } from "./PipelineCatalog";
import { PipelineNodeLibrary } from "./PipelineNodeLibrary";

import type { NodeSpec, Pipeline } from "@/lib/types";

type PipelineSidebarProps = {
  pipelines: Pipeline[];
  selectedPipelineId?: string;
  catalog: Record<string, NodeSpec[]>;
  onSelectPipeline: (pipeline: Pipeline) => void;
  onAddNode: (spec: NodeSpec) => void;
};

export function PipelineSidebar({
  pipelines,
  selectedPipelineId,
  catalog,
  onSelectPipeline,
  onAddNode,
}: PipelineSidebarProps) {
  return (
    <GlassCard className="rounded-3xl p-5">
      <PipelineCatalog
        pipelines={pipelines}
        selectedPipelineId={selectedPipelineId}
        onSelect={onSelectPipeline}
      />
      <PipelineNodeLibrary catalog={catalog} onAddNode={onAddNode} />
    </GlassCard>
  );
}
