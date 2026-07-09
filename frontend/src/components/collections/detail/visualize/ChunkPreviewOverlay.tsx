"use client";

import { X } from "lucide-react";
import { useId, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { Button } from "@/components/ui/button";
import { ModalOverlay } from "@/components/ui/modal-overlay";
import { prettyJson, timeAgo } from "@/lib/utils";

import type { ChunkDetail } from "@/lib/types";

type RenderMode = "text" | "markdown";

type ChunkPreviewOverlayProps = {
  isOpen: boolean;
  onClose: () => void;
  detail: ChunkDetail | null;
  defaultRenderMode?: RenderMode;
};

export function ChunkPreviewOverlay({
  isOpen,
  onClose,
  detail,
  defaultRenderMode = "text",
}: ChunkPreviewOverlayProps) {
  const titleId = useId();
  const [renderMode, setRenderMode] = useState<RenderMode>(defaultRenderMode);
  const chunkId = detail?.chunk.id;

  // Re-sync to the caller's preferred mode whenever the overlay opens or a different
  // chunk is loaded, without clobbering a manual Plain/Markdown toggle mid-session.
  // Adjusting state during render (rather than in an effect) replaces a remount-via-
  // `key` hack callers previously needed for the same reset.
  const syncKey = `${isOpen ? "open" : "closed"}:${chunkId ?? "empty"}`;
  const [lastSyncKey, setLastSyncKey] = useState(syncKey);
  if (syncKey !== lastSyncKey) {
    setLastSyncKey(syncKey);
    if (isOpen) {
      setRenderMode(defaultRenderMode);
    }
  }

  if (!isOpen || !detail) {
    return null;
  }

  const markdownSource = detail.chunk.text?.trim()
    ? detail.chunk.text
    : "_No chunk content available._";

  const { document, chunk } = detail;

  return (
    <ModalOverlay open onClose={onClose} labelledBy={titleId} backdropClassName="bg-canvas/80">
      <div className="flex h-[85vh] w-full max-w-5xl flex-col rounded-3xl border border-hairline bg-canvas-raised p-6 text-primary shadow-elevation-2">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.35em] text-meta">
              Chunk preview
            </p>
            <h2 id={titleId} className="mt-2 text-2xl font-semibold text-primary">
              {document.name}
            </h2>
            <p className="text-sm text-muted">
              Chunk #{chunk.chunk_index + 1} · {chunk.chunk_strategy} · {chunk.chunk_size} tokens
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-hairline p-0 text-body"
            onClick={onClose}
            aria-label="Close preview"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="mt-5 grid flex-1 gap-6 overflow-hidden lg:grid-cols-[minmax(0,1fr)_260px]">
          <div className="flex flex-col gap-3 overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-primary">Chunk text</p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setRenderMode("text")}
                  className={`rounded-full px-3 py-1 text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-violet focus-visible:ring-offset-2 focus-visible:ring-offset-canvas ${
                    renderMode === "text"
                      ? "bg-accent-violet/20 text-accent-violet"
                      : "bg-surface text-body hover:bg-surface-strong"
                  }`}
                >
                  Plain
                </button>
                <button
                  type="button"
                  onClick={() => setRenderMode("markdown")}
                  className={`rounded-full px-3 py-1 text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-violet focus-visible:ring-offset-2 focus-visible:ring-offset-canvas ${
                    renderMode === "markdown"
                      ? "bg-accent-violet/20 text-accent-violet"
                      : "bg-surface text-body hover:bg-surface-strong"
                  }`}
                >
                  Markdown
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto rounded-2xl border border-hairline bg-canvas p-4 text-sm text-body">
              {renderMode === "markdown" ? (
                <div className="prose prose-invert max-w-none text-sm">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdownSource}</ReactMarkdown>
                </div>
              ) : (
                <p className="whitespace-pre-wrap">{chunk.text || ""}</p>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-3 overflow-hidden">
            <div className="rounded-2xl border border-hairline bg-canvas p-4 text-xs text-body">
              <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-meta">Details</p>
              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <span>Document</span>
                  <span className="text-right text-primary">{document.name}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Indexed</span>
                  <span className="text-right text-primary">{timeAgo(chunk.created_at)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Chunk</span>
                  <span className="text-right text-primary">#{chunk.chunk_index + 1}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Strategy</span>
                  <span className="text-right text-primary">{chunk.chunk_strategy}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Size</span>
                  <span className="text-right text-primary">{chunk.chunk_size} tokens</span>
                </div>
              </div>
            </div>
            <div className="flex-1 overflow-hidden rounded-2xl border border-hairline bg-canvas p-4 text-xs text-body">
              <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-meta">Metadata</p>
              <pre className="mt-3 max-h-full overflow-auto whitespace-pre-wrap rounded-2xl border border-hairline bg-canvas-raised p-3 text-[11px] text-body">
                {prettyJson(chunk.metadata)}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </ModalOverlay>
  );
}
