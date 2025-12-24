"use client";

import { ChevronLeft, ChevronRight, SlidersHorizontal, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { PipelineOverridesEditor } from "@/components/collections/PipelineOverridesEditor";
import { Button } from "@/components/ui/button";
import { Loader } from "@/components/ui/loader";
import { GlassCard } from "@/components/ui/panel";
import { createCollection } from "@/lib/api";
import { cn } from "@/lib/utils";

import type { Collection, CollectionCreatePayload, NodeSpec, Pipeline } from "@/lib/types";

type WizardStep = {
  id: string;
  label: string;
  description: string;
};

type CreateCollectionWizardProps = {
  open: boolean;
  token: string;
  ingestionPipelines: Pipeline[];
  retrievalPipelines: Pipeline[];
  nodeSpecs: NodeSpec[];
  onClose: () => void;
  onCreated: (collection: Collection) => void;
};

const steps: WizardStep[] = [
  { id: "basics", label: "Basics", description: "Name and describe the collection." },
  { id: "pipelines", label: "Pipelines", description: "Choose ingestion and retrieval flows." },
  { id: "defaults", label: "Defaults", description: "Fine-tune default pipeline settings." },
  { id: "review", label: "Review", description: "Confirm and create the collection." },
];

export function CreateCollectionWizard({
  open,
  token,
  ingestionPipelines,
  retrievalPipelines,
  nodeSpecs,
  onClose,
  onCreated,
}: CreateCollectionWizardProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState<{
    name: string;
    description: string;
    ingestion_pipeline_id: string;
    retrieval_pipeline_id: string;
  }>({
    name: "",
    description: "",
    ingestion_pipeline_id: "",
    retrieval_pipeline_id: "",
  });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [ingestionOverrides, setIngestionOverrides] = useState<
    Record<string, Record<string, unknown>>
  >({});
  const [retrievalOverrides, setRetrievalOverrides] = useState<
    Record<string, Record<string, unknown>>
  >({});
  const wasOpen = useRef(false);

  const defaultIngestion = useMemo(
    () =>
      ingestionPipelines.find((pipeline) => pipeline.is_default) ?? ingestionPipelines[0] ?? null,
    [ingestionPipelines],
  );
  const defaultRetrieval = useMemo(
    () =>
      retrievalPipelines.find((pipeline) => pipeline.is_default) ?? retrievalPipelines[0] ?? null,
    [retrievalPipelines],
  );

  const pipelineNameById = useMemo(() => {
    const entries = [...ingestionPipelines, ...retrievalPipelines].map((pipeline) => [
      pipeline.id,
      pipeline.name,
    ]);
    return new Map(entries);
  }, [ingestionPipelines, retrievalPipelines]);

  useEffect(() => {
    if (open && !wasOpen.current) {
      setStepIndex(0);
      setMessage(null);
      setShowAdvanced(false);
      setIngestionOverrides({});
      setRetrievalOverrides({});
      setForm({
        name: "",
        description: "",
        ingestion_pipeline_id: defaultIngestion?.id || "",
        retrieval_pipeline_id: defaultRetrieval?.id || "",
      });
    }
    wasOpen.current = open;
  }, [open, defaultIngestion, defaultRetrieval]);

  useEffect(() => {
    if (!open) return;
    setForm((prev) => ({
      ...prev,
      ingestion_pipeline_id: prev.ingestion_pipeline_id || defaultIngestion?.id || "",
      retrieval_pipeline_id: prev.retrieval_pipeline_id || defaultRetrieval?.id || "",
    }));
  }, [open, defaultIngestion, defaultRetrieval]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  const usesDefaultPipelines =
    !!defaultIngestion &&
    !!defaultRetrieval &&
    form.ingestion_pipeline_id === defaultIngestion.id &&
    form.retrieval_pipeline_id === defaultRetrieval.id;

  const buildOverridesFromPipeline = useCallback(
    (pipeline: Pipeline | null) => {
      if (!pipeline) return {};
      const specsByType = new Map(nodeSpecs.map((spec) => [spec.type, spec]));
      return pipeline.definition.nodes.reduce<Record<string, Record<string, unknown>>>(
        (acc, node) => {
          const spec = specsByType.get(node.type);
          acc[node.id] = { ...(spec?.default_config ?? {}), ...(node.config ?? {}) };
          return acc;
        },
        {},
      );
    },
    [nodeSpecs],
  );

  useEffect(() => {
    if (!open || !showAdvanced || !usesDefaultPipelines) return;
    if (defaultIngestion && Object.keys(ingestionOverrides).length === 0) {
      setIngestionOverrides(buildOverridesFromPipeline(defaultIngestion));
    }
    if (defaultRetrieval && Object.keys(retrievalOverrides).length === 0) {
      setRetrievalOverrides(buildOverridesFromPipeline(defaultRetrieval));
    }
  }, [
    open,
    showAdvanced,
    usesDefaultPipelines,
    defaultIngestion,
    defaultRetrieval,
    buildOverridesFromPipeline,
    ingestionOverrides,
    retrievalOverrides,
  ]);

  if (!open) {
    return null;
  }

  const canProceed = () => {
    if (stepIndex === 0) {
      return form.name.trim().length > 0;
    }
    if (stepIndex === 1) {
      return form.ingestion_pipeline_id && form.retrieval_pipeline_id;
    }
    return true;
  };

  const handleCreate = async () => {
    setCreating(true);
    setMessage(null);
    try {
      const payload: CollectionCreatePayload = {
        name: form.name,
        description: form.description,
      };
      if (form.ingestion_pipeline_id) {
        payload.ingestion_pipeline_id = form.ingestion_pipeline_id;
      }
      if (form.retrieval_pipeline_id) {
        payload.retrieval_pipeline_id = form.retrieval_pipeline_id;
      }
      if (showAdvanced && usesDefaultPipelines) {
        payload.pipeline_overrides = {
          ingestion: Object.entries(ingestionOverrides).map(([nodeId, config]) => ({
            node_id: nodeId,
            config,
          })),
          retrieval: Object.entries(retrievalOverrides).map(([nodeId, config]) => ({
            node_id: nodeId,
            config,
          })),
        };
      }
      const created = await createCollection(token, payload);
      onCreated(created);
      onClose();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to create collection.");
    } finally {
      setCreating(false);
    }
  };

  const activeStep = steps[stepIndex];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 py-10 backdrop-blur-sm"
      role="presentation"
      onClick={onClose}
    >
      <GlassCard
        role="dialog"
        aria-modal="true"
        className="w-full max-w-5xl rounded-[2.5rem] border border-white/10 bg-slate-950/95 p-6 text-white"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Create collection</p>
            <h2 className="mt-2 text-2xl font-semibold">New collection wizard</h2>
            <p className="text-sm text-slate-400">{activeStep.description}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/10 p-2 text-slate-300 transition hover:border-white/30 hover:text-white"
            aria-label="Close wizard"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {message && (
          <div className="mt-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-100">
            {message}
          </div>
        )}

        <div className="mt-6 grid gap-6 lg:grid-cols-[240px_1fr]">
          <div className="space-y-3">
            {steps.map((step, index) => {
              const isActive = index === stepIndex;
              const isComplete = index < stepIndex;
              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => setStepIndex(index)}
                  className={cn(
                    "w-full rounded-2xl border px-4 py-3 text-left transition",
                    isActive
                      ? "border-violet-400 bg-violet-500/10 text-white"
                      : "border-white/10 bg-white/5 text-slate-300 hover:border-white/30",
                  )}
                >
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                    Step {index + 1}
                  </p>
                  <p className="text-base font-semibold">{step.label}</p>
                  <p className="text-xs text-slate-400">{isComplete ? "Complete" : "Pending"}</p>
                </button>
              );
            })}
          </div>

          <div className="space-y-6">
            {stepIndex === 0 && (
              <div className="space-y-4">
                <div>
                  <label className="text-xs uppercase tracking-[0.3em] text-slate-400">
                    Collection name
                  </label>
                  <input
                    type="text"
                    placeholder="Research vault"
                    required
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-violet-400"
                    value={form.name}
                    onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-xs uppercase tracking-[0.3em] text-slate-400">
                    Description
                  </label>
                  <textarea
                    placeholder="Summarize what this collection is for."
                    className="mt-2 h-24 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-violet-400"
                    value={form.description}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, description: event.target.value }))
                    }
                  />
                </div>
              </div>
            )}

            {stepIndex === 1 && (
              <div className="space-y-4">
                <div>
                  <label className="text-xs uppercase tracking-[0.3em] text-slate-400">
                    Ingestion pipeline
                  </label>
                  <select
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-violet-400"
                    value={form.ingestion_pipeline_id}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        ingestion_pipeline_id: event.target.value,
                      }))
                    }
                  >
                    {ingestionPipelines.length === 0 && (
                      <option value="">Loading pipelines...</option>
                    )}
                    {ingestionPipelines.map((pipeline) => (
                      <option key={pipeline.id} value={pipeline.id}>
                        {pipeline.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs uppercase tracking-[0.3em] text-slate-400">
                    Retrieval pipeline
                  </label>
                  <select
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-violet-400"
                    value={form.retrieval_pipeline_id}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        retrieval_pipeline_id: event.target.value,
                      }))
                    }
                  >
                    {retrievalPipelines.length === 0 && (
                      <option value="">Loading pipelines...</option>
                    )}
                    {retrievalPipelines.map((pipeline) => (
                      <option key={pipeline.id} value={pipeline.id}>
                        {pipeline.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {stepIndex === 2 && (
              <div className="space-y-4">
                <div className="rounded-3xl border border-white/10 bg-black/30 p-4">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between text-sm text-slate-200"
                    onClick={() => setShowAdvanced((prev) => !prev)}
                  >
                    <span className="flex items-center gap-2">
                      <SlidersHorizontal className="h-4 w-4 text-violet-300" />
                      Advanced pipeline defaults
                    </span>
                    <span className="text-xs text-slate-400">{showAdvanced ? "Hide" : "Show"}</span>
                  </button>
                  {showAdvanced ? (
                    <div className="mt-4 space-y-4">
                      {!usesDefaultPipelines ? (
                        <p className="text-sm text-slate-400">
                          Advanced options are available only when the default pipelines are
                          selected.
                        </p>
                      ) : nodeSpecs.length === 0 ? (
                        <div className="flex items-center gap-2 text-sm text-slate-400">
                          <Loader className="h-4 w-4" />
                          Loading node settings...
                        </div>
                      ) : (
                        <>
                          <PipelineOverridesEditor
                            title="Ingestion defaults"
                            pipeline={defaultIngestion}
                            nodeSpecs={nodeSpecs}
                            overrides={ingestionOverrides}
                            onOverridesChange={setIngestionOverrides}
                          />
                          <PipelineOverridesEditor
                            title="Retrieval defaults"
                            pipeline={defaultRetrieval}
                            nodeSpecs={nodeSpecs}
                            overrides={retrievalOverrides}
                            onOverridesChange={setRetrievalOverrides}
                          />
                        </>
                      )}
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-slate-400">
                      Keep defaults for a fast setup or enable advanced overrides for deeper tuning.
                    </p>
                  )}
                </div>
              </div>
            )}

            {stepIndex === 3 && (
              <div className="space-y-4">
                <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Summary</p>
                  <div className="mt-3 space-y-3 text-sm text-slate-200">
                    <div>
                      <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Name</p>
                      <p className="text-base font-semibold text-white">
                        {form.name || "Untitled"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
                        Description
                      </p>
                      <p className="text-sm text-slate-300">
                        {form.description || "No description provided."}
                      </p>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div>
                        <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
                          Ingestion pipeline
                        </p>
                        <p className="text-sm text-white">
                          {pipelineNameById.get(form.ingestion_pipeline_id) || "Default"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
                          Retrieval pipeline
                        </p>
                        <p className="text-sm text-white">
                          {pipelineNameById.get(form.retrieval_pipeline_id) || "Default"}
                        </p>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
                        Advanced defaults
                      </p>
                      <p className="text-sm text-slate-300">
                        {showAdvanced && usesDefaultPipelines ? "Enabled" : "Not configured"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <Button variant="ghost" onClick={onClose} disabled={creating} className="px-5">
                Cancel
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  onClick={() => setStepIndex((prev) => Math.max(prev - 1, 0))}
                  disabled={creating || stepIndex === 0}
                  className="flex items-center gap-2"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Back
                </Button>
                {stepIndex < steps.length - 1 ? (
                  <Button
                    onClick={() => setStepIndex((prev) => Math.min(prev + 1, steps.length - 1))}
                    disabled={creating || !canProceed()}
                    className="flex items-center gap-2"
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button onClick={handleCreate} loading={creating}>
                    Create collection
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}
