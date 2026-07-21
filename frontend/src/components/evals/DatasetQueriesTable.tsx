"use client";

import { Check, Pencil, Trash2, X } from "lucide-react";
import { useState } from "react";

import {
  DATASET_QUERIES_PAGE_SIZE,
  useDatasetQueries,
} from "@/components/evals/hooks/use-dataset-queries";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { TextArea } from "@/components/ui/field";
import { GlassCard } from "@/components/ui/panel";
import { getErrorMessage } from "@/lib/errors";

import type { EvalDatasetQuery, EvalQuestionType } from "@/lib/types";

const TYPE_LABEL: Record<EvalQuestionType, string> = {
  single_fact: "fact",
  paraphrased: "paraphrased",
  multi_detail: "multi-detail",
};

/**
 * The dataset's queries with their gold documents and (for synthetic
 * datasets) generation metadata. Editing a query's text keeps its gold
 * labels; deleting removes its relevance judgments with it.
 */
export function DatasetQueriesTable({ datasetId }: { datasetId: string }) {
  const { page, offset, setOffset, actionError, saveQueryText, removeQuery } =
    useDatasetQueries(datasetId);
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<EvalDatasetQuery | null>(null);

  const total = page.data?.total ?? 0;
  const items = page.data?.items ?? [];

  const save = async () => {
    if (!editing || editing.text.trim() === "") return;
    const ok = await saveQueryText(editing.id, editing.text.trim());
    if (ok) setEditing(null);
  };

  return (
    <GlassCard className="rounded-3xl border border-hairline bg-surface p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-muted">Queries</p>
        <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-meta">
          {total.toLocaleString()} total
        </p>
      </div>
      {actionError && (
        <p role="alert" className="mt-3 text-sm text-data-neg">
          {actionError}
        </p>
      )}
      {page.error ? (
        <p className="mt-4 text-sm text-data-neg">
          {getErrorMessage(page.error, "Could not load queries")}
        </p>
      ) : items.length === 0 ? (
        <p className="mt-4 text-sm text-muted">
          {page.loading ? "Loading queries…" : "No queries in this dataset."}
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-[color:var(--border-hairline)]">
          {items.map((query) => (
            <li key={query.id} className="py-3">
              {editing?.id === query.id ? (
                <div className="space-y-2">
                  <TextArea
                    rows={2}
                    value={editing.text}
                    aria-label="Query text"
                    onChange={(event) => setEditing({ id: query.id, text: event.target.value })}
                  />
                  <div className="flex gap-2">
                    <Button onClick={save} className="px-4">
                      <Check className="mr-1.5 h-3.5 w-3.5" aria-hidden /> Save
                    </Button>
                    <Button variant="secondary" onClick={() => setEditing(null)} className="px-4">
                      <X className="mr-1.5 h-3.5 w-3.5" aria-hidden /> Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm text-primary">{query.text}</p>
                    <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.28em] text-muted">
                      {query.question_type && `${TYPE_LABEL[query.question_type]} · `}
                      {query.gold.length > 0 &&
                        `gold: ${query.gold
                          .map((entry) => entry.title ?? entry.external_doc_id)
                          .join(", ")}`}
                      {query.scores &&
                        ` · scores ${["groundedness", "standalone", "realism"]
                          .map((key) => query.scores?.[key])
                          .filter((value) => value !== undefined)
                          .join("/")}`}
                    </p>
                    {query.quote && (
                      <p className="mt-1 truncate text-xs text-meta" title={query.quote}>
                        “{query.quote}”
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      aria-label={`Edit query ${query.external_query_id}`}
                      className="rounded-full p-2 text-muted transition hover:bg-surface-strong hover:text-primary focus-visible:ring-2 focus-visible:ring-accent-violet"
                      onClick={() => setEditing({ id: query.id, text: query.text })}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete query ${query.external_query_id}`}
                      className="rounded-full p-2 text-muted transition hover:bg-surface-strong hover:text-primary focus-visible:ring-2 focus-visible:ring-accent-violet"
                      onClick={() => setPendingDelete(query)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {total > DATASET_QUERIES_PAGE_SIZE && (
        <div className="mt-4 flex items-center justify-between">
          <Button
            variant="secondary"
            className="px-4"
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - DATASET_QUERIES_PAGE_SIZE))}
          >
            Previous
          </Button>
          <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-meta">
            {offset + 1}–{Math.min(offset + DATASET_QUERIES_PAGE_SIZE, total)} of{" "}
            {total.toLocaleString()}
          </p>
          <Button
            variant="secondary"
            className="px-4"
            disabled={offset + DATASET_QUERIES_PAGE_SIZE >= total}
            onClick={() => setOffset(offset + DATASET_QUERIES_PAGE_SIZE)}
          >
            Next
          </Button>
        </div>
      )}
      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete query"
        description={`Delete "${pendingDelete?.text ?? ""}" and its relevance judgments.`}
        confirmLabel="Delete query"
        confirmVariant="danger"
        onConfirm={async () => {
          if (pendingDelete) await removeQuery(pendingDelete.id);
          setPendingDelete(null);
        }}
        onCancel={() => setPendingDelete(null)}
      />
    </GlassCard>
  );
}
