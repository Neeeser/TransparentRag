"use client";

import { Check, Loader, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { TextInput } from "@/components/ui/field";
import { cn } from "@/lib/utils";

import type { ModelAvailability } from "@/lib/model-catalog-cache";
import type { CatalogModel, ProviderType } from "@/lib/types";

type RerankingModelSelectorCardProps = {
  models: CatalogModel[];
  selectedModelKey: string;
  selectedConnectionId?: string | null;
  selectedConnectionLabel?: string | null;
  selectedAvailability: ModelAvailability;
  onSelectModel: (model: CatalogModel) => void;
  onRetry: () => void;
  modelsLoading: boolean;
  modelsError: string | null;
};

const PROVIDER_LABELS: Record<ProviderType, string> = {
  openrouter: "OpenRouter",
  ollama: "Ollama",
  cohere: "Cohere",
  tei: "TEI",
  pinecone: "Pinecone",
};

const modalityLabel = (modality: string) =>
  modality.length > 0 ? `${modality[0]?.toUpperCase()}${modality.slice(1)}` : modality;

const resolveConnectionLabel = (
  models: CatalogModel[],
  currentModel: CatalogModel | null,
  selectedConnectionId?: string | null,
  selectedConnectionLabel?: string | null,
) =>
  currentModel?.connection_label ??
  selectedConnectionLabel ??
  models.find((model) => model.connection_id === selectedConnectionId)?.connection_label ??
  selectedConnectionId;

function RerankingModelList({
  models,
  loading,
  hasError,
  searchTerm,
  selectedModelKey,
  selectedConnectionId,
  onSelectModel,
}: {
  models: CatalogModel[];
  loading: boolean;
  hasError: boolean;
  searchTerm: string;
  selectedModelKey: string;
  selectedConnectionId?: string | null;
  onSelectModel: (model: CatalogModel) => void;
}) {
  if (loading && models.length === 0) {
    return <p className="text-sm text-muted">Loading reranking models…</p>;
  }
  if (models.length === 0 && !hasError) {
    return (
      <p className="text-sm text-muted">
        {searchTerm ? `No models match "${searchTerm}".` : "No reranking models available."}
      </p>
    );
  }
  const visibleModels = models.slice(0, 50);
  const rendered = visibleModels.map((model) => {
    const selected = model.id === selectedModelKey && model.connection_id === selectedConnectionId;
    const inputLimit = model.context_length ?? model.max_input_tokens;
    return (
      <button
        key={`${model.connection_id}::${model.id}`}
        type="button"
        onClick={() => onSelectModel(model)}
        className={cn(
          "w-full rounded-2xl border px-3 py-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-violet focus-visible:ring-offset-2 focus-visible:ring-offset-canvas",
          selected
            ? "border-accent-violet bg-accent-violet/10"
            : "border-hairline bg-surface hover:border-strong",
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-primary">{model.name}</p>
            <p className="break-all text-[11px] text-meta">
              {model.connection_label} · {PROVIDER_LABELS[model.provider_type]}
            </p>
            <p className="break-all text-[11px] text-meta">{model.id}</p>
          </div>
          {selected ? <Check className="h-4 w-4 shrink-0 text-accent-violet" aria-hidden /> : null}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {inputLimit ? (
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-meta">
              {inputLimit.toLocaleString()} tokens
            </span>
          ) : null}
          {model.input_modalities.map((modality) => (
            <span
              key={modality}
              className="rounded-full border border-hairline px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-meta"
            >
              {modalityLabel(modality)}
            </span>
          ))}
        </div>
      </button>
    );
  });
  return (
    <>
      {rendered}
      {models.length > visibleModels.length ? (
        <p className="text-xs text-muted">
          Showing {visibleModels.length} of {models.length} models. Search to narrow the list.
        </p>
      ) : null}
    </>
  );
}

export function RerankingModelSelectorCard({
  models,
  selectedModelKey,
  selectedConnectionId,
  selectedConnectionLabel,
  selectedAvailability,
  onSelectModel,
  onRetry,
  modelsLoading,
  modelsError,
}: RerankingModelSelectorCardProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const currentModel =
    models.find(
      (model) => model.id === selectedModelKey && model.connection_id === selectedConnectionId,
    ) ?? null;
  const connectionLabel = resolveConnectionLabel(
    models,
    currentModel,
    selectedConnectionId,
    selectedConnectionLabel,
  );
  const selectionMissing = selectedAvailability === "missing";
  const filteredModels = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return models;
    return models.filter((model) =>
      `${model.name} ${model.id} ${model.connection_label} ${model.provider_type}`
        .toLowerCase()
        .includes(term),
    );
  }, [models, searchTerm]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-body">
            {currentModel?.name || selectedModelKey || "Select a reranking model"}
          </p>
          {selectedModelKey ? (
            <p className="break-all text-[11px] text-meta">{selectedModelKey}</p>
          ) : null}
        </div>
        {modelsLoading ? (
          <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.28em] text-muted">
            <Loader className="h-3.5 w-3.5" aria-hidden />
            Syncing
          </span>
        ) : null}
      </div>

      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-meta"
          aria-hidden
        />
        <TextInput
          type="search"
          aria-label="Search reranking models"
          className="pl-9"
          placeholder="Search reranking models…"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
        />
      </div>

      {modelsError ? (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-data-neg/40 bg-data-neg/10 px-3 py-2">
          <p className="text-sm text-data-neg">{modelsError}</p>
          <Button type="button" size="sm" variant="ghost" onClick={onRetry}>
            Retry
          </Button>
        </div>
      ) : null}

      {selectionMissing ? (
        <div className="rounded-2xl border border-data-warn/40 bg-data-warn/10 px-3 py-2">
          <p className="text-sm font-semibold text-primary">Unavailable</p>
          <p className="break-all text-[11px] text-meta">
            {connectionLabel ?? "Unknown connection"} · {selectedModelKey}
          </p>
          <p className="mt-1 text-xs text-body">
            Selected model is no longer available from {connectionLabel ?? "this connection"}.
            Select another model.
          </p>
        </div>
      ) : null}

      <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
        <RerankingModelList
          models={filteredModels}
          loading={modelsLoading}
          hasError={Boolean(modelsError)}
          searchTerm={searchTerm}
          selectedModelKey={selectedModelKey}
          selectedConnectionId={selectedConnectionId}
          onSelectModel={onSelectModel}
        />
      </div>
    </div>
  );
}
