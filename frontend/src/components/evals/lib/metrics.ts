/** Pure helpers for shaping eval metric and run data for display. */

import type { EvalMetricInfo, EvalRunStatus } from "@/lib/types";

export interface MetricGroup {
  name: string;
  label: string;
  description: string;
  values: Array<{ k: number; value: number }>;
}

/** Split a `"recall@10"` aggregate key into its metric name and cutoff. */
export function parseMetricKey(key: string): { name: string; k: number } | null {
  const at = key.lastIndexOf("@");
  if (at <= 0) return null;
  const k = Number(key.slice(at + 1));
  if (!Number.isFinite(k)) return null;
  return { name: key.slice(0, at), k };
}

/** Group flat `"name@k" -> value` aggregates by metric, ordered by the catalog. */
export function groupMetrics(
  aggregates: Record<string, number>,
  catalog: EvalMetricInfo[],
): MetricGroup[] {
  const byName = new Map<string, Array<{ k: number; value: number }>>();
  for (const [key, value] of Object.entries(aggregates)) {
    const parsed = parseMetricKey(key);
    if (!parsed) continue;
    const bucket = byName.get(parsed.name) ?? [];
    bucket.push({ k: parsed.k, value });
    byName.set(parsed.name, bucket);
  }
  const catalogOrder = catalog.length ? catalog : [];
  const known = catalogOrder
    .filter((metric) => byName.has(metric.name))
    .map((metric) => ({
      name: metric.name,
      label: metric.label,
      description: metric.description,
      values: sortByK(byName.get(metric.name) ?? []),
    }));
  const knownNames = new Set(known.map((group) => group.name));
  const unknown = [...byName.entries()]
    .filter(([name]) => !knownNames.has(name))
    .map(([name, values]) => ({
      name,
      label: name,
      description: "",
      values: sortByK(values),
    }));
  return [...known, ...unknown];
}

function sortByK(values: Array<{ k: number; value: number }>): Array<{ k: number; value: number }> {
  return [...values].sort((a, b) => a.k - b.k);
}

/** Format a 0–1 metric value for display. */
export function formatMetric(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return value.toFixed(2);
}

/** Format retention as a percentage. */
export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `${Math.round(value * 100)}%`;
}

export const ACTIVE_RUN_STATUSES: readonly EvalRunStatus[] = [
  "pending",
  "provisioning",
  "ingesting",
  "running",
];

export function isRunActive(status: EvalRunStatus): boolean {
  return ACTIVE_RUN_STATUSES.includes(status);
}

/** Semantic dot tone per run status (tokens only, no raw colors). */
export function runStatusTone(status: EvalRunStatus): string {
  switch (status) {
    case "completed":
      return "bg-data-pos";
    case "failed":
      return "bg-data-neg";
    case "cancelled":
      return "bg-stage-neutral";
    default:
      return "bg-accent-violet";
  }
}
