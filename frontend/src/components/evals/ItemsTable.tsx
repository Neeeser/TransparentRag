"use client";

import Link from "next/link";

import { formatMetric } from "@/components/evals/lib/metrics";
import { GlassCard } from "@/components/ui/panel";
import { truncate } from "@/lib/utils";

import type { EvalRunItem } from "@/lib/types";

interface ItemsTableProps {
  items: EvalRunItem[];
  kValues: number[];
}

/** Per-query results; each row links to the query's full pipeline trace. */
export function ItemsTable({ items, kValues }: ItemsTableProps) {
  if (items.length === 0) {
    return null;
  }
  const headlineK = kValues.length ? Math.max(...kValues) : 10;
  const recallKey = `recall@${headlineK}`;
  const mrrKey = `mrr@${headlineK}`;

  return (
    <GlassCard className="rounded-3xl border border-hairline bg-surface p-6">
      <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-muted">Queries</p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-hairline font-mono text-[11px] uppercase tracking-[0.28em] text-muted">
              <th className="py-2 pr-4 font-normal">Query</th>
              <th className="py-2 pr-4 font-normal">Gold</th>
              <th className="py-2 pr-4 font-normal">Returned</th>
              <th className="py-2 pr-4 font-normal">Recall@{headlineK}</th>
              <th className="py-2 pr-4 font-normal">MRR@{headlineK}</th>
              <th className="py-2 font-normal">Trace</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b border-hairline align-top last:border-b-0">
                <td className="max-w-md py-3 pr-4 text-body">
                  {truncate(item.query_text, 120)}
                  {item.failed && (
                    <p className="mt-1 text-xs text-data-neg">
                      {item.error_message || "Query failed"}
                    </p>
                  )}
                </td>
                <td className="py-3 pr-4 font-mono text-xs text-body">
                  {item.gold_doc_ids.length}
                </td>
                <td className="py-3 pr-4 font-mono text-xs text-body">{item.result_count}</td>
                <td className="py-3 pr-4 font-mono text-xs text-primary">
                  {item.failed ? "—" : formatMetric(item.metrics[recallKey])}
                </td>
                <td className="py-3 pr-4 font-mono text-xs text-primary">
                  {item.failed ? "—" : formatMetric(item.metrics[mrrKey])}
                </td>
                <td className="py-3">
                  {item.pipeline_run_id ? (
                    <Link
                      href={`/traces/runs/${item.pipeline_run_id}`}
                      className="font-mono text-[11px] uppercase tracking-[0.28em] text-accent-cyan underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-accent-violet"
                    >
                      Open
                    </Link>
                  ) : (
                    <span className="text-meta">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </GlassCard>
  );
}
