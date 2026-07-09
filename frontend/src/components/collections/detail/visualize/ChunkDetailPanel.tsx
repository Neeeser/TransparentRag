"use client";

import { Loader } from "@/components/ui/loader";
import { GlassCard } from "@/components/ui/panel";
import { prettyJson, timeAgo, truncate } from "@/lib/utils";

import type { ChunkDetail, UmapPoint } from "@/lib/types";

type ChunkDetailPanelProps = {
  detail: ChunkDetail | null;
  loading: boolean;
  selectedPoint: UmapPoint | null;
  errorMessage: string | null;
  onExpand?: () => void;
};

export function ChunkDetailPanel({
  detail,
  loading,
  selectedPoint,
  errorMessage,
  onExpand,
}: ChunkDetailPanelProps) {
  if (!selectedPoint) {
    return (
      <GlassCard className="rounded-3xl border border-hairline p-6 text-sm text-body">
        Select a point to see chunk details.
      </GlassCard>
    );
  }

  if (loading) {
    return (
      <GlassCard className="flex items-center justify-center rounded-3xl border border-hairline p-6">
        <Loader className="h-5 w-5" />
      </GlassCard>
    );
  }

  if (errorMessage) {
    return (
      <GlassCard className="rounded-3xl border border-hairline p-6 text-sm text-data-neg">
        {errorMessage}
      </GlassCard>
    );
  }

  if (!detail) {
    return (
      <GlassCard className="rounded-3xl border border-hairline p-6 text-sm text-body">
        No chunk details available.
      </GlassCard>
    );
  }

  const { document, chunk } = detail;

  return (
    <GlassCard className="rounded-3xl border border-hairline p-6 text-sm text-body">
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.35em] text-muted">Document</p>
            <p className="mt-2 text-base font-semibold text-primary">{document.name}</p>
            <p className="text-xs text-muted">Indexed {timeAgo(chunk.created_at)}</p>
          </div>
          {onExpand ? (
            <button
              type="button"
              onClick={onExpand}
              className="rounded-full border border-hairline bg-surface px-3 py-1 text-xs text-body transition hover:border-strong hover:bg-surface-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-violet focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
            >
              Expand
            </button>
          ) : null}
        </div>
        <div className="grid gap-2 text-xs text-body">
          <div className="flex items-center justify-between">
            <span>Chunk</span>
            <span className="text-primary">#{chunk.chunk_index + 1}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Strategy</span>
            <span className="text-primary">{chunk.chunk_strategy}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Size</span>
            <span className="text-primary">{chunk.chunk_size} tokens</span>
          </div>
        </div>
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.35em] text-muted">Text</p>
          <p className="mt-2 whitespace-pre-wrap text-sm text-body">{truncate(chunk.text, 600)}</p>
        </div>
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.35em] text-muted">Metadata</p>
          <pre className="mt-2 max-h-56 overflow-auto rounded-2xl border border-hairline bg-canvas p-3 text-xs text-body">
            {prettyJson(chunk.metadata)}
          </pre>
        </div>
      </div>
    </GlassCard>
  );
}
