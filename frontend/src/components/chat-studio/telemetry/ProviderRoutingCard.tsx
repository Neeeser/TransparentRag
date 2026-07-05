"use client";

import { Loader, Search } from "lucide-react";

import { useProviderRoutingForm } from "@/components/chat-studio/hooks/use-provider-routing-form";
import { ProviderEndpointCard } from "@/components/chat-studio/telemetry/ProviderEndpointCard";
import { ProviderSelectionFieldList } from "@/components/chat-studio/telemetry/ProviderSelectionFieldList";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { ProviderFormState } from "@/components/chat-studio/types";
import type { ModelEndpointDirectory } from "@/lib/types";

const QUANTIZATION_OPTIONS = [
  "int4",
  "int8",
  "fp4",
  "fp6",
  "fp8",
  "fp16",
  "bf16",
  "fp32",
  "unknown",
] as const;

interface ProviderRoutingCardProps {
  providerForm: ProviderFormState;
  setProviderForm: (updater: (prev: ProviderFormState) => ProviderFormState) => void;
  providerDirectory: ModelEndpointDirectory | null;
  providerDirectoryLoading: boolean;
  providerDirectoryError: string | null;
  providerModelSlug: string | null;
  providerSearchTerm: string;
  onProviderSearchChange: (value: string) => void;
  providerRuleCount: number;
  resetProviderPreferences: () => void;
}

export const ProviderRoutingCard = ({
  providerForm,
  setProviderForm,
  providerDirectory,
  providerDirectoryLoading,
  providerDirectoryError,
  providerModelSlug,
  providerSearchTerm,
  onProviderSearchChange,
  providerRuleCount,
  resetProviderPreferences,
}: ProviderRoutingCardProps) => {
  const inputClasses =
    "w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white outline-none focus:border-violet-400";
  const endpoints = providerDirectory?.endpoints ?? [];
  const normalizedSearch = providerSearchTerm.trim().toLowerCase();
  const filteredEndpoints =
    normalizedSearch.length === 0
      ? endpoints
      : endpoints.filter((endpoint) => {
          const haystack = `${endpoint.name} ${endpoint.provider_name ?? ""} ${
            endpoint.tag ?? ""
          }`.toLowerCase();
          return haystack.includes(normalizedSearch);
        });
  const visibleEndpoints = [...filteredEndpoints].sort((a, b) => {
    const providerCompare = (a.provider_name || "").localeCompare(b.provider_name || "");
    if (providerCompare !== 0) {
      return providerCompare;
    }
    return a.name.localeCompare(b.name);
  });

  const { toggleProviderField, moveProviderOrderEntry, toggleQuantization } =
    useProviderRoutingForm(setProviderForm);

  return (
    <div className="space-y-4">
      <div className="space-y-4 rounded-2xl border border-white/10 bg-black/20 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Routing strategy</p>
            <p className="text-sm text-slate-300">
              Nitro/Floor shortcuts map to these settings. Use the catalog below to build a custom
              provider order.
            </p>
          </div>
          {providerRuleCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 rounded-full border border-white/10 px-3 text-xs text-slate-200"
              onClick={resetProviderPreferences}
            >
              Reset rules
            </Button>
          )}
        </div>
        <label className="space-y-2 text-sm text-slate-200">
          <span className="text-xs uppercase tracking-[0.3em] text-slate-500">Sort providers</span>
          <select
            className={inputClasses}
            value={providerForm.sort}
            onChange={(event) =>
              setProviderForm((prev) => ({
                ...prev,
                sort: event.target.value as ProviderFormState["sort"],
              }))
            }
          >
            <option value="">Load balance (default)</option>
            <option value="throughput">Throughput (Nitro)</option>
            <option value="price">Price (Floor)</option>
            <option value="latency">Latency</option>
          </select>
        </label>
        <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
          <label className="flex items-center justify-between gap-3 text-sm text-slate-200">
            <span className="font-medium text-white">Allow fallbacks</span>
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-white/30 bg-transparent"
              checked={providerForm.allowFallbacks}
              onChange={(event) =>
                setProviderForm((prev) => ({ ...prev, allowFallbacks: event.target.checked }))
              }
            />
          </label>
          <p className="mt-1 text-xs text-slate-400">
            Disable this to fail fast if your preferred providers are unavailable.
          </p>
        </div>
      </div>

      <div className="space-y-4 rounded-2xl border border-white/10 bg-black/20 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Provider catalog</p>
            <p className="text-sm text-slate-300">
              {providerModelSlug
                ? `Pulled from OpenRouter for ${providerModelSlug}.`
                : "Select a model to browse provider endpoints."}
            </p>
          </div>
          {providerDirectory && (
            <span className="text-[11px] uppercase tracking-[0.3em] text-slate-500">
              {providerDirectory.endpoints.length} endpoints
            </span>
          )}
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            type="search"
            className={cn(inputClasses, "pl-9 disabled:cursor-not-allowed disabled:opacity-60")}
            placeholder="Search provider slug, vendor, or tag"
            value={providerSearchTerm}
            onChange={(event) => onProviderSearchChange(event.target.value)}
            disabled={!providerModelSlug}
          />
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
          {providerDirectoryLoading ? (
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <Loader className="h-4 w-4" />
              <span>Loading endpoints…</span>
            </div>
          ) : providerDirectoryError ? (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-100">
              {providerDirectoryError}
            </div>
          ) : !providerModelSlug ? (
            <p className="text-sm text-slate-400">Pick a model to inspect its provider list.</p>
          ) : visibleEndpoints.length === 0 ? (
            <p className="text-sm text-slate-400">
              {normalizedSearch
                ? "No providers match your search."
                : "No endpoints published for this model yet."}
            </p>
          ) : (
            <div className="max-h-96 space-y-3 overflow-y-auto pr-1">
              {visibleEndpoints.map((endpoint, index) => (
                <ProviderEndpointCard
                  key={`${endpoint.name}-${endpoint.provider_name ?? "unknown"}-${endpoint.tag ?? "default"}-${index}`}
                  endpoint={endpoint}
                  position={index}
                  providerForm={providerForm}
                  onToggleField={toggleProviderField}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-4 rounded-2xl border border-white/10 bg-black/20 p-4">
        <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Selections & filters</p>
        <ProviderSelectionFieldList
          label="Order priority"
          fieldKey="order"
          values={providerForm.order}
          showIndex
          allowReorder
          onRemove={(slug) => toggleProviderField("order", slug)}
          onMove={moveProviderOrderEntry}
        />
        {providerForm.order.length > 0 && (
          <p className="text-[11px] text-slate-500">
            Requests follow this order before falling back to the OpenRouter defaults.
          </p>
        )}
        <ProviderSelectionFieldList
          label="Allow only"
          fieldKey="only"
          values={providerForm.only}
          onRemove={(slug) => toggleProviderField("only", slug)}
          onMove={moveProviderOrderEntry}
        />
        <ProviderSelectionFieldList
          label="Ignore"
          fieldKey="ignore"
          values={providerForm.ignore}
          onRemove={(slug) => toggleProviderField("ignore", slug)}
          onMove={moveProviderOrderEntry}
        />
        <div className="space-y-2">
          <span className="text-xs uppercase tracking-[0.3em] text-slate-500">Quantizations</span>
          <div className="flex flex-wrap gap-2">
            {QUANTIZATION_OPTIONS.map((option) => {
              const active = providerForm.quantizations.includes(option);
              return (
                <button
                  key={option}
                  type="button"
                  className={cn(
                    "rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.3em]",
                    active
                      ? "border-cyan-400 bg-cyan-500/20 text-white"
                      : "border-white/10 bg-white/5 text-slate-200 hover:border-white/40",
                  )}
                  onClick={() => toggleQuantization(option)}
                >
                  {option.toUpperCase()}
                </button>
              );
            })}
          </div>
          {providerForm.quantizations.length === 0 ? (
            <p className="text-xs text-slate-500">Load balance across all quantization levels.</p>
          ) : (
            <p className="text-xs text-slate-500">
              {providerForm.quantizations.length} selected • filters apply to open-weight endpoints.
            </p>
          )}
        </div>
      </div>

      <div className="space-y-3 rounded-2xl border border-white/10 bg-black/20 p-4">
        <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Data guardrails</p>
        <div className="space-y-2">
          <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
            <label className="flex items-center justify-between gap-3 text-sm text-slate-200">
              <span className="font-medium text-white">Require parameters</span>
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-white/30 bg-transparent"
                checked={providerForm.requireParameters}
                onChange={(event) =>
                  setProviderForm((prev) => ({ ...prev, requireParameters: event.target.checked }))
                }
              />
            </label>
            <p className="mt-1 text-xs text-slate-400">
              Only route to providers that support every parameter in your request.
            </p>
          </div>
          <label className="space-y-2 text-sm text-slate-200">
            <span className="text-xs uppercase tracking-[0.3em] text-slate-500">
              Data collection
            </span>
            <select
              className={inputClasses}
              value={providerForm.dataCollection}
              onChange={(event) =>
                setProviderForm((prev) => ({
                  ...prev,
                  dataCollection: event.target.value === "deny" ? "deny" : "allow",
                }))
              }
            >
              <option value="allow">Allow (default)</option>
              <option value="deny">Deny (no collection)</option>
            </select>
          </label>
          <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
            <label className="flex items-center justify-between gap-3 text-sm text-slate-200">
              <span className="font-medium text-white">Zero data retention</span>
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-white/30 bg-transparent"
                checked={providerForm.zdr}
                onChange={(event) =>
                  setProviderForm((prev) => ({ ...prev, zdr: event.target.checked }))
                }
              />
            </label>
            <p className="mt-1 text-xs text-slate-400">Only send requests to ZDR endpoints.</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
            <label className="flex items-center justify-between gap-3 text-sm text-slate-200">
              <span className="font-medium text-white">Distillable text only</span>
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-white/30 bg-transparent"
                checked={providerForm.enforceDistillableText}
                onChange={(event) =>
                  setProviderForm((prev) => ({
                    ...prev,
                    enforceDistillableText: event.target.checked,
                  }))
                }
              />
            </label>
            <p className="mt-1 text-xs text-slate-400">
              Restrict routing to models that permit text distillation.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-3 rounded-2xl border border-white/10 bg-black/20 p-4">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.35em] text-slate-500">
            Max price ($/m tokens)
          </p>
          <p className="text-sm text-slate-300">
            Cap prompt, completion, request, or image pricing for this turn.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1 text-sm text-slate-200">
            <span className="text-xs uppercase tracking-[0.3em] text-slate-500">Prompt</span>
            <input
              type="number"
              min="0"
              step="0.0001"
              className={inputClasses}
              placeholder="1.00"
              value={providerForm.maxPrompt}
              onChange={(event) =>
                setProviderForm((prev) => ({ ...prev, maxPrompt: event.target.value }))
              }
            />
          </label>
          <label className="space-y-1 text-sm text-slate-200">
            <span className="text-xs uppercase tracking-[0.3em] text-slate-500">Completion</span>
            <input
              type="number"
              min="0"
              step="0.0001"
              className={inputClasses}
              placeholder="2.00"
              value={providerForm.maxCompletion}
              onChange={(event) =>
                setProviderForm((prev) => ({ ...prev, maxCompletion: event.target.value }))
              }
            />
          </label>
          <label className="space-y-1 text-sm text-slate-200">
            <span className="text-xs uppercase tracking-[0.3em] text-slate-500">Request</span>
            <input
              type="number"
              min="0"
              step="0.0001"
              className={inputClasses}
              placeholder="0.25"
              value={providerForm.maxRequest}
              onChange={(event) =>
                setProviderForm((prev) => ({ ...prev, maxRequest: event.target.value }))
              }
            />
          </label>
          <label className="space-y-1 text-sm text-slate-200">
            <span className="text-xs uppercase tracking-[0.3em] text-slate-500">Image</span>
            <input
              type="number"
              min="0"
              step="0.0001"
              className={inputClasses}
              placeholder="0.02"
              value={providerForm.maxImage}
              onChange={(event) =>
                setProviderForm((prev) => ({ ...prev, maxImage: event.target.value }))
              }
            />
          </label>
        </div>
      </div>

      <p className="text-xs text-slate-500">
        Need a refresher? Read the{" "}
        <a
          href="https://openrouter.ai/docs/features/provider-routing"
          target="_blank"
          rel="noreferrer"
          className="text-cyan-300 underline decoration-dotted underline-offset-4"
        >
          provider routing guide
        </a>{" "}
        for tips on building multi-provider policies.
      </p>
    </div>
  );
};
