"use client";

import { GlassCard } from "@/components/ui/panel";

import { PipelineCatalog } from "./PipelineCatalog";
import { PipelineNodeLibrary } from "./PipelineNodeLibrary";

import type { NodeFamily } from "./lib/pipeline-theme";
import type { NodeSpec, Pipeline } from "@/lib/types";

type PipelineSidebarProps = {
  pipelines: Pipeline[];
  selectedPipelineId?: string;
  catalog: Array<{ family: NodeFamily; specs: NodeSpec[] }>;
  onSelectPipeline: (pipeline: Pipeline) => void;
  onDeletePipeline: (pipeline: Pipeline) => void;
  pipelineUsage: Set<string>;
  onPreviewNode: (spec: NodeSpec) => void;
};

export function PipelineSidebar({
  pipelines,
  selectedPipelineId,
  catalog,
  onSelectPipeline,
  onDeletePipeline,
  pipelineUsage,
  onPreviewNode,
}: PipelineSidebarProps) {
  return (
    <GlassCard className="rounded-3xl p-5 xl:h-full xl:overflow-y-auto">
      <PipelineCatalog
        pipelines={pipelines}
        selectedPipelineId={selectedPipelineId}
        onSelect={onSelectPipeline}
        onDelete={onDeletePipeline}
        pipelineUsage={pipelineUsage}
      />
      <PipelineNodeLibrary catalog={catalog} onPreviewNode={onPreviewNode} />
    </GlassCard>
  );
}
