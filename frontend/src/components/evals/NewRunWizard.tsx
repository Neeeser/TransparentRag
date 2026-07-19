"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { CustomSelect } from "@/components/ui/custom-select";
import { Field, TextInput } from "@/components/ui/field";
import { WizardFooter, WizardShell } from "@/components/ui/wizard-shell";
import { createEvalRun, fetchPipelines } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { useApiQuery } from "@/lib/use-api-query";
import { useAuth } from "@/providers/auth-provider";

import type { EvalDataset, Pipeline, PipelineVariable } from "@/lib/types";

interface NewRunWizardProps {
  open: boolean;
  datasets: EvalDataset[];
  onClose: () => void;
}

interface Preset {
  key: string;
  label: string;
  detail: string;
  queries: number | null; // null = all
  distractors: number | null;
}

const PRESETS: Preset[] = [
  {
    key: "quick",
    label: "Quick",
    detail: "50 queries, 200 distractors",
    queries: 50,
    distractors: 200,
  },
  {
    key: "standard",
    label: "Standard",
    detail: "500 queries, 2,000 distractors",
    queries: 500,
    distractors: 2000,
  },
  {
    key: "full",
    label: "Full",
    detail: "every query, full corpus",
    queries: null,
    distractors: null,
  },
];

const STEPS = [
  { id: "dataset", label: "Dataset", description: "What the pipelines are measured against." },
  {
    id: "pipelines",
    label: "Pipelines",
    description: "The ingestion and retrieval pair under test.",
  },
  { id: "scope", label: "Scope", description: "How much of the dataset the run covers." },
];

const DEFAULT_K = "1, 5, 10, 25";

export function NewRunWizard({ open, datasets, onClose }: NewRunWizardProps) {
  const { token } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [datasetId, setDatasetId] = useState("");
  const [ingestionId, setIngestionId] = useState("");
  const [retrievalId, setRetrievalId] = useState("");
  const [preset, setPreset] = useState("quick");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [numQueries, setNumQueries] = useState("");
  const [distractors, setDistractors] = useState("");
  const [seed, setSeed] = useState("0");
  const [kValues, setKValues] = useState(DEFAULT_K);
  const [runInputs, setRunInputs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const pipelines = useApiQuery(() => fetchPipelines(token!), [token], {
    enabled: !!token && open,
  });
  const ingestionOptions = usePipelineOptions(pipelines.data, "ingestion");
  const retrievalOptions = usePipelineOptions(pipelines.data, "retrieval");

  const dataset = datasets.find((entry) => entry.id === datasetId) ?? null;
  const retrieval = (pipelines.data ?? []).find((pipeline) => pipeline.id === retrievalId);
  const inputVariables = useMemo(
    () => declaredInputs(retrieval?.definition.variables),
    [retrieval],
  );

  const readyDatasets = datasets.filter((entry) => entry.status === "ready");
  const stepReady = [
    datasetId !== "",
    ingestionId !== "" && retrievalId !== "",
    parseKValues(kValues) !== null,
  ][step];

  const launch = async () => {
    if (!dataset) return;
    const chosen = PRESETS.find((entry) => entry.key === preset) ?? PRESETS[0];
    const kList = parseKValues(kValues);
    if (!kList) return;
    setBusy(true);
    setMessage(null);
    try {
      const run = await createEvalRun(token!, {
        dataset_id: dataset.id,
        ingestion_pipeline_id: ingestionId,
        retrieval_pipeline_id: retrievalId,
        name: `${dataset.name} · ${chosen.label}`,
        config: {
          num_queries: resolveCount(numQueries, chosen.queries, dataset.num_queries),
          distractor_pool_size: resolveCount(
            distractors,
            chosen.distractors,
            dataset.num_corpus_docs,
          ),
          seed: Number(seed) || 0,
          k_values: kList,
          selected_metrics: [],
          run_inputs: coerceInputs(runInputs, inputVariables),
        },
      });
      router.push(`/evals/runs/${run.id}`);
    } catch (err) {
      setMessage(getErrorMessage(err, "Could not start the run"));
      setBusy(false);
    }
  };

  return (
    <WizardShell
      open={open}
      title="Evals"
      subtitle="New eval run"
      steps={STEPS}
      activeStepIndex={step}
      message={message}
      onStepChange={setStep}
      onClose={onClose}
      footer={
        <WizardFooter
          step={step}
          stepCount={STEPS.length}
          onBack={() => setStep((current) => Math.max(0, current - 1))}
          onNext={() => (step === STEPS.length - 1 ? launch() : setStep(step + 1))}
          nextLabel="Start run"
          nextDisabled={!stepReady}
          busy={busy}
          onCancel={onClose}
        />
      }
    >
      {step === 0 && (
        <div className="space-y-4">
          <Field label="Dataset">
            <CustomSelect
              value={datasetId}
              placeholder={readyDatasets.length ? "Select a dataset" : "No ready datasets"}
              options={readyDatasets.map((entry) => ({
                value: entry.id,
                label: `${entry.name} (${entry.num_queries} queries, ${entry.num_corpus_docs} docs)`,
              }))}
              onValueChange={setDatasetId}
              aria-label="Dataset"
            />
          </Field>
        </div>
      )}
      {step === 1 && (
        <div className="space-y-4">
          <Field
            label="Ingestion pipeline"
            hint="Parsing, chunking, and embedding for the benchmark corpus. Runs sharing this pipeline reuse the ingested collection; changing it re-ingests."
          >
            <CustomSelect
              value={ingestionId}
              placeholder="Select an ingestion pipeline"
              options={ingestionOptions}
              onValueChange={setIngestionId}
              aria-label="Ingestion pipeline"
            />
          </Field>
          <Field label="Retrieval pipeline" hint="Queried once per benchmark query.">
            <CustomSelect
              value={retrievalId}
              placeholder="Select a retrieval pipeline"
              options={retrievalOptions}
              onValueChange={setRetrievalId}
              aria-label="Retrieval pipeline"
            />
          </Field>
          {inputVariables.map((variable) => (
            <Field
              key={variable.name}
              label={variable.name}
              hint={variable.description || "Pipeline input, held fixed for every query."}
            >
              <TextInput
                value={runInputs[variable.name] ?? defaultInputValue(variable)}
                onChange={(event) =>
                  setRunInputs((prev) => ({ ...prev, [variable.name]: event.target.value }))
                }
              />
            </Field>
          ))}
        </div>
      )}
      {step === 2 && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Run scope">
            {PRESETS.map((entry) => (
              <button
                key={entry.key}
                type="button"
                role="radio"
                aria-checked={preset === entry.key}
                onClick={() => setPreset(entry.key)}
                className={`rounded-2xl border p-4 text-left transition focus-visible:ring-2 focus-visible:ring-accent-violet ${
                  preset === entry.key
                    ? "border-accent-violet bg-surface-strong"
                    : "border-hairline bg-surface hover:border-strong"
                }`}
              >
                <p className="font-medium text-primary">{entry.label}</p>
                <p className="mt-1 text-xs text-muted">{entry.detail}</p>
              </button>
            ))}
          </div>
          <p className="text-xs text-muted">
            Sampled queries always keep every document judged relevant to them in the corpus;
            distractors set how much irrelevant material competes.
          </p>
          <button
            type="button"
            className="font-mono text-[11px] uppercase tracking-[0.28em] text-muted transition hover:text-primary focus-visible:ring-2 focus-visible:ring-accent-violet"
            aria-expanded={advancedOpen}
            onClick={() => setAdvancedOpen((prev) => !prev)}
          >
            Advanced {advancedOpen ? "−" : "+"}
          </button>
          {advancedOpen && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Queries" hint="Overrides the preset when set.">
                <TextInput
                  inputMode="numeric"
                  value={numQueries}
                  onChange={(event) => setNumQueries(event.target.value)}
                  placeholder={String(presetQueries(preset, dataset))}
                />
              </Field>
              <Field label="Distractor docs" hint="Overrides the preset when set.">
                <TextInput
                  inputMode="numeric"
                  value={distractors}
                  onChange={(event) => setDistractors(event.target.value)}
                  placeholder={String(presetDistractors(preset, dataset))}
                />
              </Field>
              <Field label="Seed" hint="Same seed, same sample — runs stay comparable.">
                <TextInput
                  inputMode="numeric"
                  value={seed}
                  onChange={(event) => setSeed(event.target.value)}
                />
              </Field>
              <Field label="k cutoffs" hint="Comma-separated; metrics compute at each.">
                <TextInput value={kValues} onChange={(event) => setKValues(event.target.value)} />
              </Field>
            </div>
          )}
        </div>
      )}
    </WizardShell>
  );
}

function usePipelineOptions(pipelines: Pipeline[] | null, kind: "ingestion" | "retrieval") {
  return useMemo(
    () =>
      (pipelines ?? [])
        .filter((pipeline) => pipeline.kind === kind)
        .map((pipeline) => ({ value: pipeline.id, label: pipeline.name })),
    [pipelines, kind],
  );
}

function declaredInputs(variables: PipelineVariable[] | undefined): PipelineVariable[] {
  return (variables ?? []).filter((variable) => variable.source === "input");
}

function defaultInputValue(variable: PipelineVariable): string {
  if (variable.value === null || variable.value === undefined) return "";
  if (typeof variable.value === "object") return "";
  return String(variable.value);
}

function coerceInputs(
  raw: Record<string, string>,
  variables: PipelineVariable[],
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const variable of variables) {
    const text = raw[variable.name] ?? defaultInputValue(variable);
    if (text === "") continue;
    if (variable.type === "integer" || variable.type === "number") {
      const numeric = Number(text);
      if (Number.isFinite(numeric)) result[variable.name] = numeric;
    } else if (variable.type === "boolean") {
      result[variable.name] = text === "true";
    } else {
      result[variable.name] = text;
    }
  }
  return result;
}

function parseKValues(text: string): number[] | null {
  const values = text
    .split(",")
    .map((part) => Number(part.trim()))
    .filter((value) => Number.isInteger(value) && value > 0);
  return values.length ? [...new Set(values)].sort((a, b) => a - b) : null;
}

function presetQueries(presetKey: string, dataset: EvalDataset | null): number {
  const chosen = PRESETS.find((entry) => entry.key === presetKey) ?? PRESETS[0];
  return resolveCount("", chosen.queries, dataset?.num_queries ?? 0);
}

function presetDistractors(presetKey: string, dataset: EvalDataset | null): number {
  const chosen = PRESETS.find((entry) => entry.key === presetKey) ?? PRESETS[0];
  return resolveCount("", chosen.distractors, dataset?.num_corpus_docs ?? 0);
}

function resolveCount(override: string, presetValue: number | null, datasetTotal: number): number {
  const numeric = Number(override);
  if (override.trim() !== "" && Number.isInteger(numeric) && numeric > 0) return numeric;
  if (presetValue === null) return Math.max(datasetTotal, 1);
  return Math.min(presetValue, Math.max(datasetTotal, 1));
}
