"use client";

import { ChevronDown } from "lucide-react";
import { useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

const stringifyData = (value: unknown): string => {
  if (typeof value === "string") {
    return value;
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

export const truncateText = (value: string, limit = 360): string => {
  const trimmed = value.trim();
  if (trimmed.length <= limit) {
    return trimmed;
  }
  return `${trimmed.slice(0, limit)}…`;
};

export const formatToolLabel = (label: string): string => {
  if (!label) return "Tool";
  const friendly = label
    .split(/[_-]+/g)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
  return friendly || "Tool";
};

const formatKeyLabel = (key: string): string => {
  return key
    .split(/[\s._-]+/g)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
};

export const JsonBlock = ({
  data,
  className,
  maxHeight = 240,
}: {
  data: unknown;
  className?: string;
  maxHeight?: number;
}) => (
  <pre
    style={{ maxHeight }}
    className={cn(
      "overflow-auto whitespace-pre-wrap break-words rounded-2xl bg-surface p-3 text-xs text-body",
      className,
    )}
  >
    {stringifyData(data)}
  </pre>
);

interface ToolValueProps {
  value: unknown;
}

export const ToolValue = ({ value }: ToolValueProps) => {
  if (value === null || value === undefined) {
    return <span className="text-muted">N/A</span>;
  }
  if (typeof value === "string") {
    return <span className="font-medium text-primary">{value}</span>;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return (
      <code className="rounded bg-surface-strong px-1 py-0.5 text-xs text-accent-cyan">
        {String(value)}
      </code>
    );
  }
  if (Array.isArray(value)) {
    const primitiveItems = value.every(
      (item) =>
        item === null ||
        item === undefined ||
        typeof item === "string" ||
        typeof item === "number" ||
        typeof item === "boolean",
    );
    if (primitiveItems) {
      return (
        <ul className="list-disc space-y-1 pl-5 text-body">
          {value.map((item, index) => (
            <li key={`tool-value-${index}`}>{String(item ?? "N/A")}</li>
          ))}
        </ul>
      );
    }
    return <JsonBlock data={value} />;
  }
  if (typeof value === "object") {
    return <JsonBlock data={value} />;
  }
  return <span className="text-primary">{String(value)}</span>;
};

interface ToolKeyValueGridProps {
  data: Record<string, unknown>;
  emptyLabel?: string;
}

export const ToolKeyValueGrid = ({
  data,
  emptyLabel = "No data available.",
}: ToolKeyValueGridProps) => {
  const entries = Object.entries(data).filter((entry) => {
    const value = entry[1];
    if (value === null || value === undefined) {
      return false;
    }
    if (typeof value === "string") {
      return value.trim().length > 0;
    }
    return true;
  });

  if (entries.length === 0) {
    return <p className="text-xs text-muted">{emptyLabel}</p>;
  }

  return (
    <dl className="grid gap-3 text-left sm:grid-cols-2">
      {entries.map(([key, value]) => (
        <div key={key} className="rounded-2xl border border-hairline bg-surface p-3">
          <dt className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted">
            {formatKeyLabel(key)}
          </dt>
          <dd className="mt-1 text-sm">
            <ToolValue value={value} />
          </dd>
        </div>
      ))}
    </dl>
  );
};

interface ToolPayloadSectionProps {
  title: string;
  description?: string;
  children: ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
}

export const ToolPayloadSection = ({
  title,
  description,
  children,
  collapsible = false,
  defaultOpen = true,
}: ToolPayloadSectionProps) => {
  const [open, setOpen] = useState(defaultOpen);

  if (!collapsible) {
    return (
      <section className="space-y-2 rounded-2xl border border-hairline bg-surface p-4">
        <header>
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted">{title}</p>
          {description && <p className="text-xs text-muted">{description}</p>}
        </header>
        {children}
      </section>
    );
  }

  return (
    <section className="space-y-2 rounded-2xl border border-hairline bg-surface p-4">
      <button
        type="button"
        className="flex w-full items-center justify-between text-left"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
      >
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted">{title}</p>
          {description && <p className="text-xs text-muted">{description}</p>}
        </div>
        <ChevronDown className={cn("h-4 w-4 text-body transition", open ? "rotate-180" : "")} />
      </button>
      {open && <div>{children}</div>}
    </section>
  );
};

interface ToolChunkListProps {
  chunks: unknown[];
  onSelectChunk?: (chunkId: string) => void;
}

export const ToolChunkList = ({ chunks, onSelectChunk }: ToolChunkListProps) => {
  const normalized = chunks
    .map((chunk) =>
      chunk && typeof chunk === "object" ? (chunk as Record<string, unknown>) : null,
    )
    .filter(Boolean) as Record<string, unknown>[];

  if (normalized.length === 0) {
    return <p className="text-xs text-muted">No chunk data returned.</p>;
  }

  return (
    <div className="space-y-3">
      {normalized.map((chunk, index) => {
        const chunkId = (chunk.chunk_id as string) || (chunk.id as string) || `chunk-${index + 1}`;
        const documentId = (chunk.document_id as string) ?? chunk.documentId;
        const order = typeof chunk.order === "number" ? chunk.order : null;
        const score =
          typeof chunk.score === "number"
            ? chunk.score
            : typeof chunk.score === "string"
              ? Number(chunk.score)
              : null;
        const textValue = typeof chunk.text === "string" ? chunk.text : null;
        const metadata =
          chunk.metadata && typeof chunk.metadata === "object"
            ? (chunk.metadata as Record<string, unknown>)
            : null;

        return (
          <article
            key={`${chunkId}-${index}`}
            className="rounded-2xl border border-hairline bg-surface p-4"
          >
            <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.3em] text-muted">
              <span>Chunk {index + 1}</span>
              {Number.isFinite(score) && (
                <span className="font-mono text-accent-cyan">Score {Number(score).toFixed(3)}</span>
              )}
            </div>
            {onSelectChunk && chunkId && (
              <button
                type="button"
                onClick={() => onSelectChunk(chunkId)}
                className="mt-2 rounded-full border border-accent-cyan/40 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.3em] text-accent-cyan hover:border-accent-cyan/80"
              >
                Trace chunk
              </button>
            )}
            {textValue && <p className="mt-2 text-sm text-body">{truncateText(textValue)}</p>}
            <dl className="mt-3 grid gap-3 text-xs text-body sm:grid-cols-2">
              {documentId && (
                <div>
                  <dt className="font-mono text-[10px] uppercase tracking-[0.3em] text-meta">
                    Document
                  </dt>
                  <dd className="font-mono text-body">{documentId}</dd>
                </div>
              )}
              {chunkId && (
                <div>
                  <dt className="font-mono text-[10px] uppercase tracking-[0.3em] text-meta">
                    Chunk ID
                  </dt>
                  <dd className="font-mono text-body break-all">{chunkId}</dd>
                </div>
              )}
              {Number.isFinite(order) && (
                <div>
                  <dt className="font-mono text-[10px] uppercase tracking-[0.3em] text-meta">
                    Order
                  </dt>
                  <dd className="font-mono text-body">{order}</dd>
                </div>
              )}
            </dl>
            {metadata && Object.keys(metadata).length > 0 && (
              <div className="mt-3">
                <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-meta">
                  Metadata
                </p>
                <JsonBlock data={metadata} maxHeight={180} className="mt-1" />
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
};
