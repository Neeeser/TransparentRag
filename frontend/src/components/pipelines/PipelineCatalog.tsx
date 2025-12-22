"use client";

import { Layers } from "lucide-react";

import { cn } from "@/lib/utils";

import type { Pipeline } from "@/lib/types";

type PipelineCatalogProps = {
  pipelines: Pipeline[];
  selectedPipelineId?: string;
  onSelect: (pipeline: Pipeline) => void;
};

export function PipelineCatalog({ pipelines, selectedPipelineId, onSelect }: PipelineCatalogProps) {
  return (
    <div>
      <div className="flex items-center gap-2 text-sm font-semibold text-white">
        <Layers className="h-4 w-4 text-violet-300" />
        Pipeline catalog
      </div>
      <div className="mt-4 space-y-3">
        {pipelines.length === 0 && (
          <p className="text-sm text-slate-400">No pipelines yet. Create one above.</p>
        )}
        {pipelines.map((pipeline) => (
          <button
            key={pipeline.id}
            type="button"
            onClick={() => onSelect(pipeline)}
            className={cn(
              "w-full rounded-2xl border px-3 py-3 text-left text-sm transition",
              selectedPipelineId === pipeline.id
                ? "border-violet-400 bg-violet-500/10 text-white"
                : "border-white/5 bg-white/5 text-slate-300 hover:border-white/20",
            )}
          >
            <p className="font-semibold">{pipeline.name}</p>
            <p className="text-xs text-slate-400">
              {pipeline.kind} • v{pipeline.current_version}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
