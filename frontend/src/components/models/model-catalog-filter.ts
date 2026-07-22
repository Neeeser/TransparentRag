"use client";

import { useMemo, useState } from "react";

import { sortChatModels, sortEmbeddingModels } from "@/lib/model-sorting";

import type { CatalogModel, UUID } from "@/lib/types";

/** One entry per connection present in a catalog, for the provider filter dropdown. */
export interface ConnectionOption {
  connectionId: UUID;
  label: string;
  providerType: string;
}

/** A models-grouped-by-connection bucket, used when the picker groups its list. */
export interface ConnectionGroup {
  connectionId: string;
  connectionLabel: string;
  providerType: string;
  models: CatalogModel[];
}

/** A selectable sort control entry. `value` drives {@link sortModelsBy}. */
export interface ModelSortDef {
  value: string;
  label: string;
}

/** Chat catalog sort controls: catalog order, or cheapest first. */
export const CHAT_MODEL_SORTS: ModelSortDef[] = [
  { value: "default", label: "Default order" },
  { value: "price", label: "Sort by price" },
];

/** Embedding catalog sort controls: cheapest first, or by vector dimension. */
export const EMBEDDING_MODEL_SORTS: ModelSortDef[] = [
  { value: "price", label: "Sort by price" },
  { value: "dimension", label: "Sort by dimension" },
];

/**
 * Sort a catalog by a {@link ModelSortDef} value. `price` and `dimension` reuse
 * the shared comparators in `model-sorting`; any other value keeps catalog order.
 */
export function sortModelsBy(models: CatalogModel[], value: string): CatalogModel[] {
  if (value === "price") return sortChatModels(models, "price");
  if (value === "dimension") return sortEmbeddingModels(models, "dimension");
  return [...models];
}

/** Case-insensitive substring match over name, id, connection label, and description. */
export function filterModelsBySearch(models: CatalogModel[], term: string): CatalogModel[] {
  const query = term.trim().toLowerCase();
  if (!query) return models;
  return models.filter((model) =>
    [model.name, model.id, model.connection_label, model.description]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(query),
  );
}

/** Derive the provider-filter options from the models actually present. */
export function buildConnectionOptions(models: CatalogModel[]): ConnectionOption[] {
  const options = new Map<UUID, ConnectionOption>();
  for (const model of models) {
    if (!options.has(model.connection_id)) {
      options.set(model.connection_id, {
        connectionId: model.connection_id,
        label: model.connection_label,
        providerType: model.provider_type,
      });
    }
  }
  return [...options.values()];
}

/** Bucket a catalog by connection, preserving first-seen order. */
export function groupModelsByConnection(models: CatalogModel[]): ConnectionGroup[] {
  const groups = new Map<string, ConnectionGroup>();
  for (const model of models) {
    const existing = groups.get(model.connection_id);
    if (existing) {
      existing.models.push(model);
    } else {
      groups.set(model.connection_id, {
        connectionId: model.connection_id,
        connectionLabel: model.connection_label,
        providerType: model.provider_type,
        models: [model],
      });
    }
  }
  return [...groups.values()];
}

interface UseModelCatalogFilterOptions {
  models: CatalogModel[];
  /** Keep only models the caller can use (structured-output support, etc.). Must be stable. */
  prefilter?: (model: CatalogModel) => boolean;
  /** Expose a provider filter and derive its options. */
  enableProviderFilter?: boolean;
  /** Sort controls to offer; the first is the initial sort. Empty = no sort control. */
  sortOptions?: ModelSortDef[];
}

interface UseModelCatalogFilterResult {
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  connectionFilter: string;
  setConnectionFilter: (value: string) => void;
  sortValue: string;
  setSortValue: (value: string) => void;
  connectionOptions: ConnectionOption[];
  filteredModels: CatalogModel[];
}

const EMPTY_SORTS: ModelSortDef[] = [];

/**
 * Owns the search / provider-filter / sort state for a model catalog and returns
 * the filtered, sorted list ready to render. Centralizing it here keeps the
 * embedding, reranking, and eval-generation pickers behaving identically; the
 * chat picker keeps its own catalog hook (which also feeds the parameter panel).
 */
export function useModelCatalogFilter({
  models,
  prefilter,
  enableProviderFilter = false,
  sortOptions = EMPTY_SORTS,
}: UseModelCatalogFilterOptions): UseModelCatalogFilterResult {
  const [searchTerm, setSearchTerm] = useState("");
  const [connectionFilter, setConnectionFilter] = useState("");
  const [sortValue, setSortValue] = useState(sortOptions[0]?.value ?? "");

  const baseModels = useMemo(
    () => (prefilter ? models.filter(prefilter) : models),
    [models, prefilter],
  );
  const connectionOptions = useMemo(() => buildConnectionOptions(baseModels), [baseModels]);
  const scopedModels = useMemo(() => {
    if (!enableProviderFilter || !connectionFilter) return baseModels;
    return baseModels.filter((model) => model.connection_id === connectionFilter);
  }, [baseModels, connectionFilter, enableProviderFilter]);
  const searchedModels = useMemo(
    () => filterModelsBySearch(scopedModels, searchTerm),
    [scopedModels, searchTerm],
  );
  const filteredModels = useMemo(
    () => (sortValue ? sortModelsBy(searchedModels, sortValue) : searchedModels),
    [searchedModels, sortValue],
  );

  return {
    searchTerm,
    setSearchTerm,
    connectionFilter,
    setConnectionFilter,
    sortValue,
    setSortValue,
    connectionOptions,
    filteredModels,
  };
}
