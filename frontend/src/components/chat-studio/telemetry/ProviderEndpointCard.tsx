"use client";

import { formatPricePerMillion } from "@/lib/format";
import { cn } from "@/lib/utils";

import type { ProviderFormState, ProviderSelectionField } from "@/components/chat-studio/lib/types";
import type { ProviderEndpoint } from "@/lib/types";

const ENDPOINT_STATUS_LABELS: Record<string, string> = {
  "0": "Operational",
  "-1": "Degraded",
  "-2": "Unhealthy",
  "-3": "Outage",
  "-5": "Offline",
  "-10": "Disabled",
};

const formatProviderPrice = (value?: number | string | null): string => {
  return formatPricePerMillion(value) ?? "—";
};

const formatUptimePercentage = (value?: number | null): string => {
  if (value === null || value === undefined) {
    return "N/A";
  }
  const normalized = value <= 1 ? value * 100 : value;
  return `${normalized.toFixed(1)}%`;
};

const getEndpointStatusLabel = (status?: string | number | null): string => {
  if (!status) {
    return "Unknown";
  }
  const key = typeof status === "number" ? String(status) : status;
  return ENDPOINT_STATUS_LABELS[key] ?? "Unknown";
};

interface ProviderEndpointCardProps {
  endpoint: ProviderEndpoint;
  position: number;
  providerForm: ProviderFormState;
  onToggleField: (field: ProviderSelectionField, slug: string) => void;
}

export const ProviderEndpointCard = ({
  endpoint,
  position,
  providerForm,
  onToggleField,
}: ProviderEndpointCardProps) => {
  const slug = endpoint.name;
  const orderActive = providerForm.order.includes(slug);
  const onlyActive = providerForm.only.includes(slug);
  const ignoreActive = providerForm.ignore.includes(slug);
  const promptPrice = formatProviderPrice(endpoint.pricing?.prompt);
  const completionPrice = formatProviderPrice(
    endpoint.pricing?.completion ?? endpoint.pricing?.request,
  );
  const maxTokens =
    endpoint.max_completion_tokens ?? endpoint.max_prompt_tokens ?? endpoint.context_length ?? null;
  const parameterCount = endpoint.supported_parameters?.length ?? 0;
  const actionClasses = (active: boolean) =>
    cn(
      "rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.3em]",
      active
        ? "border-violet-400 bg-violet-500/20 text-white"
        : "border-white/10 bg-white/5 text-slate-200 hover:border-white/40",
    );
  const cardKey = `${slug}-${endpoint.provider_name ?? "unknown"}-${endpoint.tag ?? "default"}-${position}`;
  const quantizationLabel =
    typeof endpoint.quantization === "string"
      ? endpoint.quantization?.toUpperCase()
      : endpoint.quantization && typeof endpoint.quantization === "object"
        ? Object.values(endpoint.quantization)
            .filter(Boolean)
            .map((value) => String(value))
            .join(", ")
        : null;

  return (
    <div
      key={cardKey}
      className="space-y-4 rounded-2xl border border-white/10 bg-gradient-to-b from-black/60 to-black/30 p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-mono text-sm text-white">{slug}</p>
          <p className="text-xs text-slate-400">{endpoint.provider_name || "Unknown provider"}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.3em] text-slate-500">
          <span>{getEndpointStatusLabel(endpoint.status)}</span>
          <span>Uptime {formatUptimePercentage(endpoint.uptime_last_30m)}</span>
          {endpoint.tag && (
            <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-slate-200">
              {endpoint.tag}
            </span>
          )}
          {endpoint.supports_implicit_caching && (
            <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-200">
              Cache
            </span>
          )}
          {quantizationLabel && (
            <span className="rounded-full border border-cyan-400/30 bg-cyan-500/10 px-2 py-0.5 text-[10px] text-cyan-100">
              {quantizationLabel}
            </span>
          )}
        </div>
      </div>
      <div className="grid gap-2 text-sm text-slate-200 sm:grid-cols-2">
        <div className="rounded-xl border border-white/5 bg-black/40 p-3">
          <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">Prompt</p>
          <p className="text-lg font-semibold text-white">{promptPrice}</p>
        </div>
        <div className="rounded-xl border border-white/5 bg-black/40 p-3">
          <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">Completion</p>
          <p className="text-lg font-semibold text-white">{completionPrice}</p>
        </div>
        <div className="rounded-xl border border-white/5 bg-black/40 p-3">
          <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">Capacity</p>
          <p className="text-lg font-semibold text-white">
            {maxTokens ? `${Math.round(maxTokens).toLocaleString()} tokens` : "—"}
          </p>
        </div>
        <div className="rounded-xl border border-white/5 bg-black/40 p-3">
          <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">Supported params</p>
          <p className="text-lg font-semibold text-white">{parameterCount}</p>
        </div>
      </div>
      <div className="grid gap-2 text-center text-xs uppercase tracking-[0.3em] text-white sm:grid-cols-3">
        <button
          type="button"
          className={actionClasses(orderActive)}
          onClick={() => onToggleField("order", slug)}
        >
          {orderActive ? "In order" : "Add to order"}
        </button>
        <button
          type="button"
          className={actionClasses(onlyActive)}
          onClick={() => onToggleField("only", slug)}
        >
          {onlyActive ? "Allowing" : "Allow only"}
        </button>
        <button
          type="button"
          className={actionClasses(ignoreActive)}
          onClick={() => onToggleField("ignore", slug)}
        >
          {ignoreActive ? "Ignored" : "Ignore"}
        </button>
      </div>
    </div>
  );
};
