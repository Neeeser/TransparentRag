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
      <GlassCard className="flex items-center justify-center rounded-3xl border border-hairline p-6">
        <p className="text-center text-sm text-muted text-balance">
          Select a point to see chunk details.
        </p>
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
          <div className="min-w-0">
            <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-muted">Document</p>
            <p className="mt-1 truncate text-base font-semibold tracking-tight text-primary">
              {document.name}
            </p>
            <p className="text-xs text-meta">Indexed {timeAgo(chunk.created_at)}</p>
          </div>
          {onExpand ? (
            <button
              type="button"
              onClick={onExpand}
              className="shrink-0 rounded-full border border-hairline bg-surface px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-body transition hover:border-strong hover:bg-surface-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-violet focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
            >
              Expand
            </button>
          ) : null}
        </div>
        <dl className="grid gap-1.5 border-t border-hairline pt-3">
          {(
            [
              ["Chunk", `#${chunk.chunk_index + 1}`],
              ["Strategy", chunk.chunk_strategy],
              ["Size", `${chunk.chunk_size} tokens`],
            ] as const
          ).map(([label, value]) => (
            <div key={label} className="flex items-center justify-between gap-3">
              <dt className="font-mono text-[10px] uppercase tracking-[0.2em] text-meta">
                {label}
              </dt>
              <dd className="text-xs text-primary">{value}</dd>
            </div>
          ))}
        </dl>
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-muted">Text</p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-body">
            {truncate(chunk.text, 600)}
          </p>
        </div>
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-muted">Metadata</p>
          <pre className="mt-2 max-h-56 overflow-auto rounded-2xl border border-hairline bg-surface p-3 text-xs text-body">
            {prettyJson(chunk.metadata)}
          </pre>
        </div>
      </div>
    </GlassCard>
  );
}
