"use client";

import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/panel";

import type { PipelineNodeData } from "./PipelineNode";
import type { Node } from "@xyflow/react";

type PipelineInspectorProps = {
  selectedNode: Node<PipelineNodeData> | null;
  configDraft: string;
  onConfigDraftChange: (value: string) => void;
  onLabelChange: (value: string) => void;
  onApplyConfig: () => void;
};

export function PipelineInspector({
  selectedNode,
  configDraft,
  onConfigDraftChange,
  onLabelChange,
  onApplyConfig,
}: PipelineInspectorProps) {
  return (
    <GlassCard className="rounded-3xl p-5">
      <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Inspector</p>
      {selectedNode ? (
        <div className="mt-4 space-y-3 text-sm">
          <div>
            <p className="text-xs text-slate-400">Node label</p>
            <input
              className="mt-1 w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-violet-400"
              value={selectedNode.data.label}
              onChange={(event) => onLabelChange(event.target.value)}
            />
          </div>
          <div>
            <p className="text-xs text-slate-400">Node type</p>
            <p className="text-sm text-white">{selectedNode.data.nodeType}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Description</p>
            <p className="text-sm text-slate-200">
              {selectedNode.data.description || "No description available."}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Example</p>
            <p className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200">
              {selectedNode.data.example || "No example available."}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Config</p>
            <textarea
              className="mt-1 h-40 w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white outline-none focus:border-violet-400"
              value={configDraft}
              onChange={(event) => onConfigDraftChange(event.target.value)}
            />
          </div>
          <Button variant="secondary" onClick={onApplyConfig}>
            Apply config
          </Button>
        </div>
      ) : (
        <p className="mt-3 text-sm text-slate-400">
          Select a node to inspect or tweak configuration.
        </p>
      )}
    </GlassCard>
  );
}
