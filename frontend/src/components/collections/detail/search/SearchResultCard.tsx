"use client";

import { FileText } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { QueryChunk } from "@/lib/types";

function documentLabel(chunk: QueryChunk): string {
  const metadata = chunk.metadata ?? {};
  for (const key of ["document_name", "file_name", "name", "source"]) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }
  if (typeof chunk.document_id === "string" && chunk.document_id) {
    return `Document ${chunk.document_id.slice(0, 8)}`;
  }
  return "Document";
}

type SearchResultCardProps = {
  chunk: QueryChunk;
  rank: number;
  topScore: number;
  onTrace: () => void;
};

/** One retrieved chunk: source, score bar, expandable text, metadata. */
export function SearchResultCard({ chunk, rank, topScore, onTrace }: SearchResultCardProps) {
  const [expanded, setExpanded] = useState(false);
  const score = chunk.score ?? 0;
  const text = chunk.text ?? "";
  const metadataEntries = Object.entries(chunk.metadata ?? {})
    .filter(([, value]) => ["string", "number", "boolean"].includes(typeof value))
    .slice(0, 4);

  return (
    <article className="rounded-2xl border border-hairline bg-surface p-4 transition hover:border-strong">
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-meta">
          #{rank}
        </span>
        <FileText className="h-4 w-4 shrink-0 text-muted" aria-hidden />
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-primary">
          {documentLabel(chunk)}
        </span>
        <span className="font-mono text-[11px] text-muted">{score.toFixed(3)}</span>
        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-surface-strong">
          <div
            className="h-full rounded-full bg-gradient-to-r from-grad-from to-grad-to"
            style={{ width: `${topScore > 0 ? Math.max(4, (score / topScore) * 100) : 0}%` }}
          />
        </div>
      </div>

      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
        className="mt-3 w-full rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-violet"
      >
        <p
          className={cn(
            "whitespace-pre-wrap text-sm leading-relaxed text-body",
            !expanded && "line-clamp-3",
          )}
        >
          {text}
        </p>
        <span className="mt-1 inline-block font-mono text-[10px] uppercase tracking-[0.2em] text-meta">
          {expanded ? "Collapse" : "Expand"}
        </span>
      </button>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {metadataEntries.map(([key, value]) => (
          <span
            key={key}
            className="rounded-full border border-hairline px-2.5 py-0.5 font-mono text-[10px] text-meta"
          >
            {key}: {String(value)}
          </span>
        ))}
        <span className="ml-auto">
          <Button variant="ghost" size="sm" onClick={onTrace}>
            Trace
          </Button>
        </span>
      </div>
    </article>
  );
}
