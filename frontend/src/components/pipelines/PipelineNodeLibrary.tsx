"use client";

import { getNodeFamilyLabel, getNodeFamilyStyles, type NodeFamily } from "./lib/pipeline-theme";

import type { NodeSpec } from "@/lib/types";
import type { DragEvent } from "react";

type PipelineNodeLibraryProps = {
  catalog: Array<{ family: NodeFamily; specs: NodeSpec[] }>;
  onPreviewNode: (spec: NodeSpec) => void;
};

const NODE_DRAG_TYPE = "application/ragworks-node";

export function PipelineNodeLibrary({ catalog, onPreviewNode }: PipelineNodeLibraryProps) {
  const handleDragStart = (event: DragEvent<HTMLButtonElement>, spec: NodeSpec) => {
    event.dataTransfer.setData(NODE_DRAG_TYPE, spec.type);
    event.dataTransfer.effectAllowed = "move";
  };

  return (
    <div className="mt-6 border-t border-hairline pt-4">
      <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted">Node library</p>
      <p className="mt-2 text-xs text-meta">Drag nodes into the canvas to add them.</p>
      <div className="mt-3 space-y-4">
        {catalog.map(({ family, specs }) => {
          const styles = getNodeFamilyStyles(family);
          return (
            <div key={family}>
              <p className={`text-xs uppercase tracking-[0.3em] ${styles.badge}`}>
                {getNodeFamilyLabel(family)}
              </p>
              <div className="mt-2 space-y-2">
                {specs.map((spec) => (
                  <button
                    key={spec.type}
                    type="button"
                    onClick={() => onPreviewNode(spec)}
                    onDragStart={(event) => handleDragStart(event, spec)}
                    draggable
                    className={`w-full rounded-xl border border-hairline bg-surface px-3 py-2 text-left text-xs text-body ${styles.border} hover:border-strong`}
                  >
                    <p className="font-semibold">{spec.label}</p>
                    <p className="text-[10px] text-meta">{spec.type}</p>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
