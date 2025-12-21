"use client";

import type {
  ModelParameterKey,
  ParameterDefinition,
  ParameterOverrides,
} from "@/lib/chat-parameters";
import type { Collection, ModelInfo } from "@/lib/types";

interface ModelParametersCardProps {
  collection: Collection | null;
  currentModelInfo: ModelInfo | null;
  visibleParameterDefinitions: ParameterDefinition[];
  parameterOverrides: ParameterOverrides;
  activeParameterCount: number;
  resetAllParameters: () => void;
  handleNumberParameterChange: (
    key: ModelParameterKey,
    rawValue: string,
    asInteger?: boolean,
  ) => void;
  handleBooleanParameterChange: (key: ModelParameterKey, checked: boolean) => void;
  handleTextParameterChange: (key: ModelParameterKey, value: string) => void;
  handleSelectParameterChange: (key: ModelParameterKey, value: string) => void;
  handleClearParameter: (key: ModelParameterKey) => void;
  formatDefaultParameter: (key: ModelParameterKey) => string | null;
  modelsError: string | null;
  modelsLoading: boolean;
}

export const ModelParametersCard = ({
  collection,
  currentModelInfo,
  visibleParameterDefinitions,
  parameterOverrides,
  activeParameterCount,
  resetAllParameters,
  handleNumberParameterChange,
  handleBooleanParameterChange,
  handleTextParameterChange,
  handleSelectParameterChange,
  handleClearParameter,
  formatDefaultParameter,
  modelsError,
  modelsLoading,
}: ModelParametersCardProps) => {
  const selectedModelLabel = currentModelInfo?.id || collection?.chat_model || "the selected model";

  if (modelsError) {
    return <p className="text-sm text-rose-300">{modelsError}</p>;
  }
  if (modelsLoading && !currentModelInfo) {
    return <p className="text-sm text-slate-400">Loading model catalog…</p>;
  }
  if (!collection) {
    return <p className="text-sm text-slate-400">Select a collection to view model controls.</p>;
  }
  if (!currentModelInfo) {
    return (
      <p className="text-sm text-slate-400">
        Unable to find OpenRouter metadata for{" "}
        <span className="text-white">{selectedModelLabel}</span>.
      </p>
    );
  }
  if (visibleParameterDefinitions.length === 0) {
    return (
      <p className="text-sm text-slate-400">
        This model does not expose the common sampling parameters listed in the OpenRouter docs.
      </p>
    );
  }

  const inputClasses =
    "w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-violet-400";

  const renderParameterControl = (definition: ParameterDefinition) => {
    const hasOverride = Object.prototype.hasOwnProperty.call(parameterOverrides, definition.key);
    const currentValue = parameterOverrides[definition.key];
    const defaultDisplay = formatDefaultParameter(definition.key);

    let control: React.ReactNode;
    if (definition.input === "number" || definition.input === "integer") {
      control = (
        <input
          type="number"
          min={definition.min}
          max={definition.max}
          step={definition.step ?? (definition.input === "integer" ? 1 : 0.05)}
          className={inputClasses}
          placeholder={definition.placeholder}
          value={typeof currentValue === "number" ? currentValue : ""}
          onChange={(event) =>
            handleNumberParameterChange(
              definition.key,
              event.target.value,
              definition.input === "integer",
            )
          }
        />
      );
    } else if (definition.input === "boolean") {
      control = (
        <label className="flex items-center gap-3 text-sm text-slate-200">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-white/30 bg-transparent"
            checked={currentValue === true}
            onChange={(event) => handleBooleanParameterChange(definition.key, event.target.checked)}
          />
          <span>Enable</span>
        </label>
      );
    } else if (definition.input === "select") {
      control = (
        <select
          className={inputClasses}
          value={typeof currentValue === "string" ? currentValue : ""}
          onChange={(event) => handleSelectParameterChange(definition.key, event.target.value)}
        >
          {(definition.options ?? []).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      );
    } else {
      control = (
        <textarea
          className={`${inputClasses} h-auto`}
          rows={definition.rows ?? 2}
          placeholder={definition.placeholder}
          value={typeof currentValue === "string" ? currentValue : ""}
          onChange={(event) => handleTextParameterChange(definition.key, event.target.value)}
        />
      );
    }

    return (
      <div
        key={definition.key}
        className="space-y-3 rounded-2xl border border-white/10 bg-black/20 p-3"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-white">{definition.label}</p>
            <p className="text-xs text-slate-400">{definition.description}</p>
            {defaultDisplay && (
              <p className="text-[11px] text-slate-500">Default: {defaultDisplay}</p>
            )}
          </div>
          <button
            type="button"
            className="text-xs text-slate-400 transition hover:text-white disabled:opacity-40"
            disabled={!hasOverride}
            onClick={() => handleClearParameter(definition.key)}
          >
            Clear
          </button>
        </div>
        {control}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/10 bg-black/20 p-3 text-sm text-slate-300">
        <p className="text-[11px] uppercase tracking-[0.35em] text-slate-500">Model</p>
        <p className="text-white">{currentModelInfo.name}</p>
        <p className="text-[11px] text-slate-500 break-all">{currentModelInfo.id}</p>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] uppercase tracking-[0.3em] text-slate-500">
          <span>{visibleParameterDefinitions.length} controls</span>
          {activeParameterCount > 0 && (
            <button
              type="button"
              onClick={resetAllParameters}
              className="text-slate-200 underline-offset-4 hover:underline"
            >
              Reset overrides
            </button>
          )}
        </div>
      </div>
      <div className="space-y-4">
        {visibleParameterDefinitions.map((definition) => renderParameterControl(definition))}
      </div>
    </div>
  );
};
