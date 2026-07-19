import { apiFetch } from "@/lib/api/client";

import type {
  BuiltinDatasetInfo,
  EvalCollection,
  EvalDataset,
  EvalDatasetUploadPayload,
  EvalMetricInfo,
  EvalRun,
  EvalRunCreatePayload,
  EvalRunItem,
  EvalRunSummary,
} from "@/lib/types";

export async function fetchEvalBenchmarks(token: string): Promise<BuiltinDatasetInfo[]> {
  return apiFetch<BuiltinDatasetInfo[]>("/api/evals/benchmarks", { token });
}

export async function fetchEvalMetricCatalog(token: string): Promise<EvalMetricInfo[]> {
  return apiFetch<EvalMetricInfo[]>("/api/evals/metrics", { token });
}

export async function fetchEvalDatasets(token: string): Promise<EvalDataset[]> {
  return apiFetch<EvalDataset[]>("/api/evals/datasets", { token });
}

export async function fetchEvalDataset(token: string, datasetId: string): Promise<EvalDataset> {
  return apiFetch<EvalDataset>(`/api/evals/datasets/${datasetId}`, { token });
}

export async function importEvalBenchmark(
  token: string,
  key: string,
  name?: string,
): Promise<EvalDataset> {
  return apiFetch<EvalDataset>("/api/evals/datasets/import", {
    token,
    method: "POST",
    body: JSON.stringify({ key, name: name ?? null }),
  });
}

export async function uploadEvalDataset(
  token: string,
  payload: EvalDatasetUploadPayload,
): Promise<EvalDataset> {
  return apiFetch<EvalDataset>("/api/evals/datasets/upload", {
    token,
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function deleteEvalDataset(token: string, datasetId: string): Promise<void> {
  await apiFetch<void>(`/api/evals/datasets/${datasetId}`, { token, method: "DELETE" });
}

export async function createEvalRun(
  token: string,
  payload: EvalRunCreatePayload,
): Promise<EvalRun> {
  return apiFetch<EvalRun>("/api/evals/runs", {
    token,
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchEvalRuns(token: string): Promise<EvalRunSummary[]> {
  return apiFetch<EvalRunSummary[]>("/api/evals/runs", { token });
}

export async function fetchEvalRun(token: string, runId: string): Promise<EvalRun> {
  return apiFetch<EvalRun>(`/api/evals/runs/${runId}`, { token });
}

export async function fetchEvalRunItems(token: string, runId: string): Promise<EvalRunItem[]> {
  return apiFetch<EvalRunItem[]>(`/api/evals/runs/${runId}/items`, { token });
}

export async function cancelEvalRun(token: string, runId: string): Promise<EvalRun> {
  return apiFetch<EvalRun>(`/api/evals/runs/${runId}/cancel`, { token, method: "POST" });
}

export async function deleteEvalRun(token: string, runId: string): Promise<void> {
  await apiFetch<void>(`/api/evals/runs/${runId}`, { token, method: "DELETE" });
}

export async function fetchEvalCollections(token: string): Promise<EvalCollection[]> {
  return apiFetch<EvalCollection[]>("/api/evals/collections", { token });
}

export async function deleteEvalCollection(token: string, collectionId: string): Promise<void> {
  await apiFetch<void>(`/api/evals/collections/${collectionId}`, { token, method: "DELETE" });
}
