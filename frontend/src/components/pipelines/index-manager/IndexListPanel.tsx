"use client";

import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";

import type { VectorIndex } from "@/lib/types";

type IndexListPanelProps = {
  indexes: VectorIndex[];
  loading: boolean;
  viewMode: "details" | "create";
  selectedName: string | null;
  onSelectIndex: (name: string) => void;
  onSelectCreate: () => void;
};

/** The left-hand rail of the index manager: the scrollable list of existing indexes
 * plus the "Create index" action that switches the details panel into create mode. */
export function IndexListPanel({
  indexes,
  loading,
  viewMode,
  selectedName,
  onSelectIndex,
  onSelectCreate,
}: IndexListPanelProps) {
  return (
    <div className="space-y-3">
      <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted">Indexes</p>
      <div className="space-y-2">
        {loading ? (
          <p className="rounded-2xl border border-hairline bg-surface px-4 py-3 text-sm text-body">
            Loading indexes...
          </p>
        ) : indexes.length === 0 ? (
          <p className="rounded-2xl border border-hairline bg-surface px-4 py-3 text-sm text-body">
            No indexes found.
          </p>
        ) : (
          indexes.map((index) => {
            const isActive = viewMode === "details" && index.name === selectedName;
            return (
              <button
                key={index.name}
                type="button"
                onClick={() => onSelectIndex(index.name)}
                className={`w-full rounded-2xl border px-4 py-3 text-left text-sm transition ${
                  isActive
                    ? "border-accent-violet bg-accent-violet/10 text-primary"
                    : "border-hairline bg-surface text-body hover:border-strong"
                }`}
              >
                <div className="font-semibold">{index.name}</div>
                <div className="text-xs text-muted">
                  {index.vector_type ?? "dense"} · {index.metric ?? "cosine"}
                </div>
              </button>
            );
          })
        )}
      </div>
      <Button
        variant={viewMode === "create" ? "primary" : "secondary"}
        onClick={onSelectCreate}
        className="w-full inline-flex items-center justify-center gap-2"
      >
        <Plus className="h-4 w-4" />
        Create index
      </Button>
    </div>
  );
}
