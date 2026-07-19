"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { GlassCard } from "@/components/ui/panel";
import { formatDateTime } from "@/lib/datetime";

import type { EvalCollection, EvalDataset } from "@/lib/types";

interface CollectionsPanelProps {
  collections: EvalCollection[];
  datasets: EvalDataset[];
  loading: boolean;
  onDelete: (collectionId: string) => Promise<boolean>;
}

export function CollectionsPanel({
  collections,
  datasets,
  loading,
  onDelete,
}: CollectionsPanelProps) {
  const [pendingDelete, setPendingDelete] = useState<EvalCollection | null>(null);
  const [busy, setBusy] = useState(false);
  const datasetNames = new Map(datasets.map((dataset) => [dataset.id, dataset.name]));

  return (
    <GlassCard className="rounded-3xl border border-hairline bg-surface p-6">
      <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-muted">
        Benchmark collections
      </p>
      <p className="mt-2 text-sm text-body">
        Ingested benchmark corpora, keyed by dataset and ingestion pipeline. Runs that share an
        ingestion pipeline reuse the same collection; deleting one frees its vectors and files, and
        the next run re-ingests.
      </p>
      {collections.length === 0 ? (
        <p className="mt-6 text-sm text-muted">
          {loading ? "Loading…" : "Nothing provisioned yet."}
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-[color:var(--border-hairline)]">
          {collections.map((collection) => (
            <li key={collection.id} className="flex items-center justify-between gap-4 py-3">
              <div className="min-w-0">
                <p className="truncate font-medium text-primary">{collection.name}</p>
                <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.28em] text-muted">
                  {(collection.dataset_id && datasetNames.get(collection.dataset_id)) || "dataset"}{" "}
                  · {collection.num_documents} docs · {collection.num_chunks} chunks · updated{" "}
                  {formatDateTime(collection.updated_at)}
                </p>
              </div>
              <Button
                variant="secondary"
                className="shrink-0 px-4"
                onClick={() => setPendingDelete(collection)}
              >
                <Trash2 className="mr-2 h-4 w-4" aria-hidden />
                Prune
              </Button>
            </li>
          ))}
        </ul>
      )}
      <ConfirmDialog
        open={pendingDelete !== null}
        title="Prune benchmark collection"
        description={`Delete ${pendingDelete?.name ?? "this collection"} — its vectors, files, and indexes. Past run results are kept; the next run against this ingestion config re-ingests.`}
        confirmLabel="Prune"
        confirmVariant="danger"
        loading={busy}
        onConfirm={async () => {
          if (!pendingDelete) return;
          setBusy(true);
          await onDelete(pendingDelete.id);
          setBusy(false);
          setPendingDelete(null);
        }}
        onCancel={() => setPendingDelete(null)}
      />
    </GlassCard>
  );
}
