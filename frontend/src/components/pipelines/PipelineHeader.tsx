"use client";

import { Plus } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { PIPELINE_KINDS } from "./lib/pipeline-kinds";

import type { PipelineKind } from "@/lib/types";

type PipelineHeaderProps = {
  kind: PipelineKind;
  onCreatePipeline: () => void;
  onManageIndexes: () => void;
};

export function PipelineHeader({ kind, onCreatePipeline, onManageIndexes }: PipelineHeaderProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.35em] text-muted">Pipelines</p>
        <h1 className="text-3xl font-semibold tracking-tight text-primary">
          {kind === "ingestion" ? "Build ingestion flows." : "Design retrieval flows."}
        </h1>
        <div className="mt-3 flex flex-wrap gap-2">
          {PIPELINE_KINDS.map((value) => (
            <Link
              key={value}
              href={`/pipelines/${value}`}
              className={cn(
                "rounded-full border border-hairline px-3 py-1 text-xs uppercase tracking-[0.35em] transition",
                value === kind
                  ? "border-strong bg-surface-strong text-primary"
                  : "text-muted hover:border-strong hover:text-primary",
              )}
            >
              {value}
            </Link>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap gap-3">
        <Button variant="secondary" onClick={onManageIndexes}>
          Manage indexes
        </Button>
        <Button onClick={onCreatePipeline}>
          <Plus className="h-4 w-4" />
          {kind === "ingestion" ? "New ingestion pipeline" : "New retrieval pipeline"}
        </Button>
      </div>
    </div>
  );
}
