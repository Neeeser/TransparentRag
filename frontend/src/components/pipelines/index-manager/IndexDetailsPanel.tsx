"use client";

import { Trash2 } from "lucide-react";

import type { VectorIndex } from "@/lib/types";

type IndexDetailsPanelProps = {
  index: VectorIndex | null;
  onDelete: (name: string) => void;
};

/** Read-only detail card for the selected vector index, plus the entry point into
 * the delete-confirmation flow (owned by the parent IndexManagerModal). */
export function IndexDetailsPanel({ index, onDelete }: IndexDetailsPanelProps) {
  return (
    <div className="rounded-3xl border border-hairline bg-surface p-5">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted">Index details</p>
        <button
          type="button"
          className="rounded-full border border-hairline p-2 text-muted transition hover:border-data-neg/60 hover:text-data-neg disabled:opacity-40"
          onClick={() => index && onDelete(index.name)}
          disabled={!index}
          aria-label="Delete index"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      {index ? (
        <div className="mt-4 grid gap-4 text-sm text-body md:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-meta">Name</p>
            <p className="text-base font-semibold text-primary">{index.name}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-meta">Status</p>
            <p className="text-sm text-body">
              {(index.status as { state?: string } | null)?.state ?? "Unknown"}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-meta">Backend</p>
            <p className="text-sm text-body">
              {index.backend === "pgvector" ? "pgvector (PostgreSQL)" : "Pinecone"}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-meta">Vector type</p>
            <p className="text-sm text-body">{index.vector_type ?? "dense"}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-meta">Dimension</p>
            <p className="text-sm text-body">{index.dimension ?? "n/a"}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-meta">Metric</p>
            <p className="text-sm text-body">{index.metric ?? "cosine"}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-meta">Host</p>
            <p className="text-xs text-body break-all">{index.host ?? "Not available"}</p>
          </div>
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted">Select an index to see details.</p>
      )}
    </div>
  );
}
