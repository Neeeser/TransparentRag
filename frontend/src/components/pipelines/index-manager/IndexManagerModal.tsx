"use client";

import { Plus, RefreshCw, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/panel";
import { createPineconeIndex, deletePineconeIndex } from "@/lib/api";

import type { PineconeIndex, PineconeIndexCreatePayload } from "@/lib/types";

type IndexManagerModalProps = {
  open: boolean;
  token: string;
  indexes: PineconeIndex[];
  loading?: boolean;
  error?: string | null;
  onClose: () => void;
  onRefresh: () => void;
};

const METRIC_OPTIONS = ["cosine", "euclidean", "dotproduct"];
const CLOUD_OPTIONS = ["aws", "gcp", "azure"];

export function IndexManagerModal({
  open,
  token,
  indexes,
  loading = false,
  error = null,
  onClose,
  onRefresh,
}: IndexManagerModalProps) {
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState<PineconeIndexCreatePayload>({
    name: "",
    vector_type: "dense",
    dimension: 1536,
    metric: "cosine",
    cloud: "aws",
    region: "us-east-1",
    deletion_protection: "disabled",
  });
  const [message, setMessage] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");

  const sortedIndexes = useMemo(
    () => [...indexes].sort((a, b) => a.name.localeCompare(b.name)),
    [indexes],
  );
  const selectedIndex = sortedIndexes.find((index) => index.name === selectedName) ?? null;

  useEffect(() => {
    if (!open) return;
    if (!selectedName && sortedIndexes.length > 0) {
      setSelectedName(sortedIndexes[0].name);
    }
  }, [open, selectedName, sortedIndexes]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const handleCreate = async () => {
    setCreating(true);
    setMessage(null);
    try {
      const payload: PineconeIndexCreatePayload = {
        ...createForm,
        name: createForm.name.trim(),
      };
      if (payload.vector_type === "sparse") {
        delete payload.dimension;
      }
      await createPineconeIndex(token, payload);
      setCreateForm((prev) => ({ ...prev, name: "" }));
      onRefresh();
      setMessage("Index created.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Unable to create index.");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedIndex) return;
    setDeleting(true);
    setMessage(null);
    try {
      await deletePineconeIndex(selectedIndex.name, token);
      setDeleteConfirm("");
      onRefresh();
      setSelectedName(null);
      setMessage("Index deletion requested.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Unable to delete index.");
    } finally {
      setDeleting(false);
    }
  };

  const dimensionDisabled = createForm.vector_type === "sparse";

  const handleVectorTypeChange = (value: string) => {
    setCreateForm((prev) => {
      if (value === "sparse") {
        return { ...prev, vector_type: value, dimension: undefined, metric: "dotproduct" };
      }
      return {
        ...prev,
        vector_type: value,
        dimension: prev.dimension ?? 1536,
        metric: prev.metric ?? "cosine",
      };
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 py-8 backdrop-blur-sm"
      role="presentation"
      onClick={onClose}
    >
      <GlassCard
        role="dialog"
        aria-modal="true"
        className="w-full max-w-6xl rounded-[2.5rem] border border-white/10 bg-slate-950/95 p-6 text-white"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Manage indexes</p>
            <h2 className="mt-2 text-2xl font-semibold">Pinecone index manager</h2>
            <p className="text-sm text-slate-400">
              Create, review, and delete serverless indexes tied to this API key.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={onRefresh} disabled={loading}>
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>

        {message ? (
          <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-slate-200">
            {message}
          </div>
        ) : null}
        {error ? (
          <div className="mt-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-100">
            {error}
          </div>
        ) : null}

        <div className="mt-6 grid gap-6 lg:grid-cols-[280px_1fr]">
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Indexes</p>
            <div className="space-y-2">
              {loading ? (
                <p className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
                  Loading indexes...
                </p>
              ) : sortedIndexes.length === 0 ? (
                <p className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
                  No indexes found.
                </p>
              ) : (
                sortedIndexes.map((index) => {
                  const isActive = index.name === selectedName;
                  return (
                    <button
                      key={index.name}
                      type="button"
                      onClick={() => setSelectedName(index.name)}
                      className={`w-full rounded-2xl border px-4 py-3 text-left text-sm transition ${
                        isActive
                          ? "border-violet-400 bg-violet-500/10 text-white"
                          : "border-white/10 bg-white/5 text-slate-300 hover:border-white/30"
                      }`}
                    >
                      <div className="font-semibold">{index.name}</div>
                      <div className="text-xs text-slate-400">
                        {index.vector_type ?? "dense"} · {index.metric ?? "cosine"}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Index details</p>
              {selectedIndex ? (
                <div className="mt-4 grid gap-4 text-sm text-slate-200 md:grid-cols-2">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Name</p>
                    <p className="text-base font-semibold text-white">{selectedIndex.name}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Status</p>
                    <p className="text-sm text-slate-200">
                      {(selectedIndex.status as { state?: string } | null)?.state ?? "Unknown"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Vector type</p>
                    <p className="text-sm text-slate-200">{selectedIndex.vector_type ?? "dense"}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Dimension</p>
                    <p className="text-sm text-slate-200">{selectedIndex.dimension ?? "n/a"}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Metric</p>
                    <p className="text-sm text-slate-200">{selectedIndex.metric ?? "cosine"}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Host</p>
                    <p className="text-xs text-slate-300 break-all">
                      {selectedIndex.host ?? "Not available"}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="mt-3 text-sm text-slate-400">Select an index to see details.</p>
              )}

              {selectedIndex ? (
                <div className="mt-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-100">
                  <p className="text-xs uppercase tracking-[0.3em] text-rose-200/80">
                    Delete index
                  </p>
                  <p className="mt-2 text-sm text-rose-100">
                    Type <span className="font-semibold">{selectedIndex.name}</span> to confirm.
                  </p>
                  <input
                    className="mt-3 w-full rounded-2xl border border-rose-500/40 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none"
                    value={deleteConfirm}
                    onChange={(event) => setDeleteConfirm(event.target.value)}
                    placeholder="Enter index name to confirm"
                  />
                  <Button
                    variant="danger"
                    onClick={handleDelete}
                    loading={deleting}
                    disabled={deleteConfirm !== selectedIndex.name}
                    className="mt-3 w-full"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete index
                  </Button>
                </div>
              ) : null}
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Create new index</p>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="text-xs uppercase tracking-[0.3em] text-slate-400">
                    Index name
                  </label>
                  <input
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-violet-400"
                    value={createForm.name}
                    onChange={(event) =>
                      setCreateForm((prev) => ({ ...prev, name: event.target.value }))
                    }
                    placeholder="research-vault"
                  />
                </div>
                <div>
                  <label className="text-xs uppercase tracking-[0.3em] text-slate-400">
                    Vector type
                  </label>
                  <select
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-violet-400"
                    value={createForm.vector_type ?? "dense"}
                    onChange={(event) => handleVectorTypeChange(event.target.value)}
                  >
                    <option value="dense">Dense</option>
                    <option value="sparse">Sparse</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs uppercase tracking-[0.3em] text-slate-400">
                    Dimension
                  </label>
                  <input
                    type="number"
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-violet-400"
                    value={createForm.dimension ?? ""}
                    onChange={(event) =>
                      setCreateForm((prev) => ({
                        ...prev,
                        dimension: event.target.value ? Number(event.target.value) : undefined,
                      }))
                    }
                    placeholder="1536"
                    disabled={dimensionDisabled}
                  />
                  {dimensionDisabled ? (
                    <p className="mt-2 text-xs text-slate-400">
                      Sparse indexes do not require a dimension.
                    </p>
                  ) : null}
                </div>
                <div>
                  <label className="text-xs uppercase tracking-[0.3em] text-slate-400">
                    Metric
                  </label>
                  <select
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-violet-400"
                    value={createForm.metric ?? "cosine"}
                    onChange={(event) =>
                      setCreateForm((prev) => ({ ...prev, metric: event.target.value }))
                    }
                    disabled={createForm.vector_type === "sparse"}
                  >
                    {METRIC_OPTIONS.map((metric) => (
                      <option key={metric} value={metric}>
                        {metric}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs uppercase tracking-[0.3em] text-slate-400">Cloud</label>
                  <select
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-violet-400"
                    value={createForm.cloud ?? "aws"}
                    onChange={(event) =>
                      setCreateForm((prev) => ({ ...prev, cloud: event.target.value }))
                    }
                  >
                    {CLOUD_OPTIONS.map((cloud) => (
                      <option key={cloud} value={cloud}>
                        {cloud}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs uppercase tracking-[0.3em] text-slate-400">
                    Region
                  </label>
                  <input
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-violet-400"
                    value={createForm.region ?? ""}
                    onChange={(event) =>
                      setCreateForm((prev) => ({ ...prev, region: event.target.value }))
                    }
                    placeholder="us-east-1"
                  />
                </div>
              </div>
              <Button
                onClick={handleCreate}
                loading={creating}
                className="mt-4 flex items-center gap-2"
                disabled={!createForm.name.trim()}
              >
                <Plus className="h-4 w-4" />
                Create index
              </Button>
            </div>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}
