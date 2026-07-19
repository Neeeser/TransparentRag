/** Eval wire types, hand-mirrored from `app/schemas/evals.py`. */

import type { UUID } from "@/lib/types/common";

export type EvalDatasetSource = "builtin_benchmark" | "custom_upload" | "synthetic";

export type EvalDatasetStatus = "pending" | "downloading" | "ready" | "failed";

export type RelevanceGranularity = "document" | "chunk";

export type EvalRunStatus =
  | "pending"
  | "provisioning"
  | "ingesting"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export type EvalFindingSeverity = "info" | "warning" | "critical";

/** Mirrors `BuiltinDatasetInfo` — a curated benchmark before import. */
export interface BuiltinDatasetInfo {
  key: string;
  name: string;
  description: string;
  num_queries: number;
  num_corpus_docs: number;
}

/** Mirrors `EvalDatasetRead`. */
export interface EvalDataset {
  id: UUID;
  name: string;
  description?: string | null;
  source: EvalDatasetSource;
  source_ref?: string | null;
  relevance_granularity: RelevanceGranularity;
  status: EvalDatasetStatus;
  error_message?: string | null;
  num_queries: number;
  num_corpus_docs: number;
  created_at: string;
  updated_at: string;
}

/** Mirrors `EvalMetricInfo` — a registered metric plus its tooltip text. */
export interface EvalMetricInfo {
  name: string;
  label: string;
  description: string;
  is_rank_aware: boolean;
}

/** Mirrors `EvalRunConfig`. */
export interface EvalRunConfig {
  num_queries: number;
  distractor_pool_size: number;
  seed: number;
  k_values: number[];
  selected_metrics: string[];
  run_inputs: Record<string, unknown>;
}

/** Mirrors `EvalRunCreate`. */
export interface EvalRunCreatePayload {
  dataset_id: UUID;
  ingestion_pipeline_id: UUID;
  retrieval_pipeline_id: UUID;
  name?: string | null;
  config: EvalRunConfig;
}

/** Mirrors `FunnelStage` — aggregate gold retention at one pipeline node. */
export interface FunnelStage {
  node_id: string;
  node_type: string;
  label: string;
  gold_retained: number;
  gold_total: number;
  retention: number;
}

/** Mirrors `EvalFinding` — a node-addressed recommendation. */
export interface EvalFinding {
  node_id: string;
  label: string;
  severity: EvalFindingSeverity;
  category: string;
  message: string;
}

/** Mirrors `FunnelSummary`. */
export interface FunnelSummary {
  stages: FunnelStage[];
  findings: EvalFinding[];
}

/** Mirrors `EvalRunItemRead` — one evaluated query. */
export interface EvalRunItem {
  id: UUID;
  query_external_id: string;
  query_text: string;
  pipeline_run_id?: UUID | null;
  result_count: number;
  gold_doc_ids: string[];
  retrieved_document_ids: string[];
  metrics: Record<string, number>;
  failed: boolean;
  error_message?: string | null;
}

/** Mirrors `EvalRunRead`. */
export interface EvalRun {
  id: UUID;
  name?: string | null;
  dataset_id: UUID;
  eval_collection_id?: UUID | null;
  ingestion_pipeline_id: UUID;
  retrieval_pipeline_id: UUID;
  status: EvalRunStatus;
  config: EvalRunConfig;
  progress_done: number;
  progress_total: number;
  aggregate_metrics: Record<string, number>;
  funnel: FunnelSummary;
  error_message?: string | null;
  created_at: string;
  updated_at: string;
  completed_at?: string | null;
}

/** Mirrors `EvalRunSummary` — the list-view row. */
export interface EvalRunSummary {
  id: UUID;
  name?: string | null;
  dataset_id: UUID;
  status: EvalRunStatus;
  progress_done: number;
  progress_total: number;
  aggregate_metrics: Record<string, number>;
  created_at: string;
}

/** Mirrors `EvalCollectionRead` — a provisioned benchmark collection. */
export interface EvalCollection {
  id: UUID;
  name: string;
  dataset_id?: UUID | null;
  ingestion_pipeline_id?: UUID | null;
  num_documents: number;
  num_chunks: number;
  created_at: string;
  updated_at: string;
}

/** Request body for `POST /api/evals/datasets/upload`. */
export interface EvalDatasetUploadPayload {
  name: string;
  description?: string | null;
  corpus: string;
  queries: string;
  qrels: string;
}
