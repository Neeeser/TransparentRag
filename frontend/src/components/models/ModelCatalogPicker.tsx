"use client";

import { Loader, Search } from "lucide-react";

import { groupModelsByConnection } from "@/components/models/model-catalog-filter";
import { Button } from "@/components/ui/button";

import type { ConnectionOption, ModelSortDef } from "@/components/models/model-catalog-filter";
import type { CatalogModel } from "@/lib/types";
import type { ReactNode } from "react";

/** The selected model no longer resolves in the catalog; kept visible so the user replaces it. */
export interface UnavailableSelection {
  key: string;
  connectionLabel?: string | null;
  message?: string | null;
}

interface ModelCatalogPickerProps {
  /** The final list to display — already prefiltered, searched, and sorted. */
  models: CatalogModel[];
  selectedModelKey: string;

  // Header
  headerPlaceholder: string;
  currentModel?: CatalogModel | null;
  headerSubtitle?: ReactNode;
  headerAccessory?: ReactNode;
  description?: string;
  modelsLoading: boolean;

  // Search (controlled)
  searchTerm: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  searchAriaLabel?: string;

  // Provider filter (controlled, optional)
  connectionOptions?: ConnectionOption[];
  connectionFilter?: string;
  onConnectionFilterChange?: (connectionId: string) => void;

  // Sort (controlled, optional)
  sortOptions?: ModelSortDef[];
  sortValue?: string;
  onSortChange?: (value: string) => void;

  /** Extra control rendered on the controls row before the sort dropdown. */
  controlsLeading?: ReactNode;

  // Error + optional retry
  modelsError?: string | null;
  onRetry?: () => void;

  // Unavailable-selection warning
  unavailable?: UnavailableSelection | null;

  // List
  groupByConnection?: boolean;
  noun: string;
  emptyLabel: string;
  /** Renders one model row — the caller composes a {@link ModelOptionButton} with its badges. */
  renderModel: (model: CatalogModel) => ReactNode;
  maxVisible?: number;
}

const controlSelectClass =
  "w-full rounded-2xl border border-hairline bg-surface px-3 py-2 text-xs text-body outline-none focus:border-accent-violet";

function PickerHeader({
  title,
  subtitle,
  accessory,
  loading,
}: {
  title: string;
  subtitle?: ReactNode;
  accessory?: ReactNode;
  loading: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm text-body">{title}</p>
        {subtitle ? <p className="break-all text-[11px] text-meta">{subtitle}</p> : null}
      </div>
      <div className="flex shrink-0 items-center gap-2 text-right">
        {accessory}
        {loading ? (
          <span className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.2em] text-body">
            <Loader className="h-3.5 w-3.5" aria-hidden />
            Syncing
          </span>
        ) : null}
      </div>
    </div>
  );
}

function ProviderFilterSelect({
  options,
  value,
  onChange,
}: {
  options: ConnectionOption[];
  value?: string;
  onChange: (connectionId: string) => void;
}) {
  return (
    <div className="min-w-[160px] flex-1">
      <select
        aria-label="Filter models by provider"
        className={controlSelectClass}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">All providers</option>
        {options.map((option) => (
          <option key={option.connectionId} value={option.connectionId}>
            {option.label} ({option.providerType})
          </option>
        ))}
      </select>
    </div>
  );
}

function SortSelect({
  options,
  value,
  onChange,
}: {
  options: ModelSortDef[];
  value?: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="min-w-[160px]">
      <select
        aria-label="Sort models"
        className={controlSelectClass}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function PickerControls({
  connectionOptions,
  connectionFilter,
  onConnectionFilterChange,
  sortOptions,
  sortValue,
  onSortChange,
  controlsLeading,
}: Pick<
  ModelCatalogPickerProps,
  | "connectionOptions"
  | "connectionFilter"
  | "onConnectionFilterChange"
  | "sortOptions"
  | "sortValue"
  | "onSortChange"
  | "controlsLeading"
>) {
  const showProviderFilter = Boolean(onConnectionFilterChange && connectionOptions);
  const showSort = Boolean(onSortChange && sortOptions && sortOptions.length > 0);
  if (!controlsLeading && !showProviderFilter && !showSort) {
    return null;
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      {controlsLeading}
      {showProviderFilter ? (
        <ProviderFilterSelect
          options={connectionOptions ?? []}
          value={connectionFilter}
          onChange={(value) => onConnectionFilterChange?.(value)}
        />
      ) : null}
      {showSort ? (
        <SortSelect
          options={sortOptions ?? []}
          value={sortValue}
          onChange={(value) => onSortChange?.(value)}
        />
      ) : null}
    </div>
  );
}

function SelectionStates({
  modelsError,
  onRetry,
  unavailable,
}: {
  modelsError?: string | null;
  onRetry?: () => void;
  unavailable?: UnavailableSelection | null;
}) {
  return (
    <>
      {modelsError && onRetry ? (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-data-neg/40 bg-data-neg/10 px-3 py-2">
          <p className="text-sm text-data-neg">{modelsError}</p>
          <Button type="button" size="sm" variant="ghost" onClick={onRetry}>
            Retry
          </Button>
        </div>
      ) : null}
      {modelsError && !onRetry ? <p className="text-sm text-data-neg">{modelsError}</p> : null}
      {unavailable ? (
        <div className="rounded-2xl border border-data-warn/40 bg-data-warn/10 px-3 py-2">
          <p className="text-sm font-semibold text-primary">Unavailable</p>
          <p className="break-all text-[11px] text-meta">
            {unavailable.connectionLabel
              ? `${unavailable.connectionLabel} · ${unavailable.key}`
              : unavailable.key}
          </p>
          {unavailable.message ? (
            <p className="mt-1 text-xs text-body">{unavailable.message}</p>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

function ModelList({
  models,
  visibleModels,
  modelsLoading,
  searchTerm,
  noun,
  emptyLabel,
  groupByConnection,
  renderModel,
}: {
  models: CatalogModel[];
  visibleModels: CatalogModel[];
  modelsLoading: boolean;
  searchTerm: string;
  noun: string;
  emptyLabel: string;
  groupByConnection: boolean;
  renderModel: (model: CatalogModel) => ReactNode;
}) {
  const hiddenCount = models.length - visibleModels.length;
  if (modelsLoading && models.length === 0) {
    return <p className="text-sm text-muted">Loading {noun}s…</p>;
  }
  if (visibleModels.length === 0) {
    return (
      <p className="text-sm text-muted">
        {searchTerm ? `No models match "${searchTerm}".` : emptyLabel}
      </p>
    );
  }
  return (
    <>
      {groupByConnection
        ? groupModelsByConnection(visibleModels).map((group) => (
            <div key={group.connectionId} className="space-y-2">
              <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-meta">
                <span className="text-body">{group.connectionLabel}</span>
                <span className="rounded-full border border-hairline px-2 py-0.5">
                  {group.providerType}
                </span>
              </div>
              {group.models.map((model) => renderModel(model))}
            </div>
          ))
        : visibleModels.map((model) => renderModel(model))}
      {hiddenCount > 0 ? (
        <p className="text-xs text-muted">
          Showing {visibleModels.length} of {models.length} models. Search to narrow the list.
        </p>
      ) : null}
    </>
  );
}

/**
 * The shared model picker chrome: selected-model header, search box, optional
 * provider/sort controls, error and unavailable-selection states, and the
 * scrollable model list (flat or grouped by connection). It is fully controlled
 * — the caller owns filter state (via `useModelCatalogFilter` or its own catalog
 * hook) and renders each row through `renderModel`, so chat, embedding,
 * reranking, and eval generation share one look and one set of states.
 */
export function ModelCatalogPicker({
  models,
  selectedModelKey,
  headerPlaceholder,
  currentModel,
  headerSubtitle,
  headerAccessory,
  description,
  modelsLoading,
  searchTerm,
  onSearchChange,
  searchPlaceholder,
  searchAriaLabel,
  connectionOptions,
  connectionFilter,
  onConnectionFilterChange,
  sortOptions,
  sortValue,
  onSortChange,
  controlsLeading,
  modelsError,
  onRetry,
  unavailable,
  groupByConnection = false,
  noun,
  emptyLabel,
  renderModel,
  maxVisible = 50,
}: ModelCatalogPickerProps) {
  const visibleModels = models.slice(0, maxVisible);

  return (
    <div className="space-y-3">
      <PickerHeader
        title={currentModel?.name || selectedModelKey || headerPlaceholder}
        subtitle={headerSubtitle}
        accessory={headerAccessory}
        loading={modelsLoading}
      />

      {description ? <p className="text-xs text-muted">{description}</p> : null}

      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-meta"
          aria-hidden
        />
        <input
          type="search"
          aria-label={searchAriaLabel}
          className="w-full rounded-2xl border border-hairline bg-surface py-2 pl-9 pr-3 text-sm text-primary outline-none placeholder:text-meta focus:border-accent-violet"
          placeholder={searchPlaceholder}
          value={searchTerm}
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </div>

      <PickerControls
        connectionOptions={connectionOptions}
        connectionFilter={connectionFilter}
        onConnectionFilterChange={onConnectionFilterChange}
        sortOptions={sortOptions}
        sortValue={sortValue}
        onSortChange={onSortChange}
        controlsLeading={controlsLeading}
      />

      <SelectionStates modelsError={modelsError} onRetry={onRetry} unavailable={unavailable} />

      <div className="max-h-72 space-y-3 overflow-y-auto pr-1">
        <ModelList
          models={models}
          visibleModels={visibleModels}
          modelsLoading={modelsLoading}
          searchTerm={searchTerm}
          noun={noun}
          emptyLabel={emptyLabel}
          groupByConnection={groupByConnection}
          renderModel={renderModel}
        />
      </div>
    </div>
  );
}
