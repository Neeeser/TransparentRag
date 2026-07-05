import { apiFetch } from "@/lib/api/client";

import type {
  NodeSpec,
  PineconeIndex,
  PineconeIndexCreatePayload,
  Pipeline,
  PipelineDefinition,
  PipelineKind,
  PipelineValidationResult,
  PipelineVersion,
} from "@/lib/types";

export async function fetchPipelines(token: string, kind?: PipelineKind): Promise<Pipeline[]> {
  const params = kind ? `?kind=${kind}` : "";
  return apiFetch<Pipeline[]>(`/api/pipelines${params}`, { token });
}

export async function fetchPipeline(token: string, pipelineId: string): Promise<Pipeline> {
  return apiFetch<Pipeline>(`/api/pipelines/${pipelineId}`, { token });
}

export async function fetchPipelineNodes(token: string): Promise<NodeSpec[]> {
  const response = await apiFetch<{ nodes: NodeSpec[] }>("/api/pipelines/nodes", { token });
  return response.nodes;
}

export async function listPineconeIndexes(token: string): Promise<PineconeIndex[]> {
  const response = await apiFetch<{ indexes: PineconeIndex[] }>("/api/indexes", { token });
  return response.indexes ?? [];
}

export async function describePineconeIndex(
  token: string,
  indexName: string,
): Promise<PineconeIndex> {
  return apiFetch<PineconeIndex>(`/api/indexes/${indexName}`, { token });
}

export async function createPineconeIndex(
  token: string,
  payload: PineconeIndexCreatePayload,
): Promise<PineconeIndex> {
  return apiFetch<PineconeIndex>("/api/indexes", {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  });
}

export async function deletePineconeIndex(
  token: string,
  indexName: string,
): Promise<{ status: string }> {
  return apiFetch<{ status: string }>(`/api/indexes/${indexName}`, {
    method: "DELETE",
    token,
  });
}

export async function validatePipeline(
  token: string,
  definition: PipelineDefinition,
): Promise<PipelineValidationResult> {
  return apiFetch<PipelineValidationResult>("/api/pipelines/validate", {
    method: "POST",
    token,
    body: JSON.stringify(definition),
  });
}

export async function createPipeline(
  token: string,
  payload: {
    name: string;
    kind: PipelineKind;
    definition: PipelineDefinition;
    description?: string;
    change_summary?: string;
  },
): Promise<Pipeline> {
  return apiFetch<Pipeline>("/api/pipelines", {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  });
}

export async function updatePipeline(
  token: string,
  pipelineId: string,
  payload: {
    name?: string;
    description?: string;
    definition?: PipelineDefinition;
    change_summary?: string;
  },
): Promise<Pipeline> {
  return apiFetch<Pipeline>(`/api/pipelines/${pipelineId}`, {
    method: "PATCH",
    token,
    body: JSON.stringify(payload),
  });
}

export async function deletePipeline(
  token: string,
  pipelineId: string,
): Promise<{ status: string }> {
  return apiFetch<{ status: string }>(`/api/pipelines/${pipelineId}`, {
    method: "DELETE",
    token,
  });
}

export async function listPipelineVersions(
  token: string,
  pipelineId: string,
): Promise<PipelineVersion[]> {
  return apiFetch<PipelineVersion[]>(`/api/pipelines/${pipelineId}/versions`, { token });
}

export async function activatePipelineVersion(
  token: string,
  pipelineId: string,
  version: number,
): Promise<Pipeline> {
  return apiFetch<Pipeline>(`/api/pipelines/${pipelineId}/activate`, {
    method: "POST",
    token,
    body: JSON.stringify({ version }),
  });
}
