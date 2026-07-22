"use client";

import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

import type { CatalogModel } from "@/lib/types";
import type { ReactNode } from "react";

interface ModelOptionButtonProps {
  model: CatalogModel;
  selected: boolean;
  onSelect: (model: CatalogModel) => void;
  /** Secondary line under the name — defaults to the raw model id. */
  subtitle?: ReactNode;
  /** Metadata row (context, pricing, dimensions, modalities) the caller composes. */
  children?: ReactNode;
}

/**
 * The shared selectable model row: name, subtitle, selected highlight, and a
 * caller-supplied metadata row. Every model picker (chat, embedding, reranking,
 * eval generation) renders this shell so a model reads the same everywhere;
 * only the metadata badges differ per catalog kind.
 */
export function ModelOptionButton({
  model,
  selected,
  onSelect,
  subtitle,
  children,
}: ModelOptionButtonProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(model)}
      className={cn(
        "w-full rounded-2xl border px-3 py-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-violet focus-visible:ring-offset-2 focus-visible:ring-offset-canvas",
        selected
          ? "border-accent-violet bg-accent-violet/10 text-primary"
          : "border-hairline bg-surface text-body hover:border-strong",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-primary">{model.name}</p>
          <p className="break-all text-[11px] text-meta">{subtitle ?? model.id}</p>
        </div>
        {selected ? <Check className="h-4 w-4 shrink-0 text-accent-violet" aria-hidden /> : null}
      </div>
      {children}
    </button>
  );
}

interface ModelMetaBadgeProps {
  /** Short mono caption (e.g. "ctx", "in", "out"). Omit for a bare value. */
  label?: string;
  value: ReactNode;
}

/**
 * One metadata datum in a model row: a small uppercase caption plus its value,
 * in the instrument-label voice. Used to build the per-model badge rows.
 */
export function ModelMetaBadge({ label, value }: ModelMetaBadgeProps) {
  return (
    <span className="text-body">
      {label ? (
        <span className="mr-1.5 text-[10px] uppercase tracking-[0.2em] text-meta">{label}</span>
      ) : null}
      {value}
    </span>
  );
}
