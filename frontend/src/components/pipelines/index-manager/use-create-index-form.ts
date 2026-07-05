"use client";

import { useState } from "react";

import { createPineconeIndex } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";

import type { EmbeddingModelInfo, PineconeIndexCreatePayload } from "@/lib/types";

export const METRIC_OPTIONS = ["cosine", "euclidean", "dotproduct"];
export const CLOUD_OPTIONS = ["aws", "gcp", "azure"];
export const REGION_OPTIONS: Record<string, string[]> = {
  aws: ["us-east-1", "us-west-2", "eu-west-1"],
  gcp: ["us-central1", "us-east1", "europe-west1"],
  azure: ["eastus", "westeurope", "southeastasia"],
};

const DEFAULT_FORM: PineconeIndexCreatePayload = {
  name: "",
  vector_type: "dense",
  dimension: 1536,
  metric: "cosine",
  cloud: "aws",
  region: "us-east-1",
  deletion_protection: "disabled",
};

interface UseCreateIndexFormParams {
  token: string;
  embeddingModels: EmbeddingModelInfo[];
  onCreated: () => void;
  onError: (message: string) => void;
}

export interface UseCreateIndexFormResult {
  createForm: PineconeIndexCreatePayload;
  creating: boolean;
  useModelDimension: boolean;
  selectedEmbeddingModelId: string;
  selectedEmbeddingModel: EmbeddingModelInfo | null;
  createDisabled: boolean;
  createDisabledReason: string | null;
  setName: (value: string) => void;
  setMetric: (value: string) => void;
  setRegion: (value: string) => void;
  setDimension: (value: number | undefined) => void;
  handleVectorTypeChange: (value: string) => void;
  handleCloudChange: (value: string) => void;
  handleDimensionModeChange: (mode: "manual" | "model") => void;
  handleSelectEmbeddingModel: (modelId: string) => void;
  handleCreate: () => Promise<void>;
}

/**
 * Owns the create-index form's vector-type/cloud/dimension coupling: switching to a
 * sparse index clears the dimension and forces the "dotproduct" metric; switching cloud
 * resets the region to that cloud's first option; and toggling "from model" pulls the
 * dimension from the selected embedding model instead of a manually-typed number.
 * Also owns the create submission itself, reporting success/failure via the
 * `onCreated`/`onError` callbacks rather than local UI state.
 */
export function useCreateIndexForm({
  token,
  embeddingModels,
  onCreated,
  onError,
}: UseCreateIndexFormParams): UseCreateIndexFormResult {
  const [createForm, setCreateForm] = useState<PineconeIndexCreatePayload>({ ...DEFAULT_FORM });
  const [creating, setCreating] = useState(false);
  const [useModelDimension, setUseModelDimension] = useState(false);
  const [selectedEmbeddingModelId, setSelectedEmbeddingModelId] = useState("");

  const selectedEmbeddingModel =
    embeddingModels.find((model) => model.id === selectedEmbeddingModelId) ?? null;
  const dimensionValid =
    createForm.vector_type === "sparse" ||
    (typeof createForm.dimension === "number" && createForm.dimension > 0);
  const createDisabled =
    !createForm.name.trim() || !dimensionValid || (useModelDimension && !selectedEmbeddingModelId);
  const createDisabledReason = !createForm.name.trim()
    ? "Enter an index name to continue."
    : createForm.vector_type === "dense" && useModelDimension && !selectedEmbeddingModelId
      ? "Select an embedding model to set the dimension."
      : createForm.vector_type === "dense" && !dimensionValid
        ? "Enter a dimension to create a dense index."
        : null;

  const setName = (value: string) => setCreateForm((prev) => ({ ...prev, name: value }));
  const setMetric = (value: string) => setCreateForm((prev) => ({ ...prev, metric: value }));
  const setRegion = (value: string) => setCreateForm((prev) => ({ ...prev, region: value }));
  const setDimension = (value: number | undefined) =>
    setCreateForm((prev) => ({ ...prev, dimension: value }));

  const handleVectorTypeChange = (value: string) => {
    setCreateForm((prev) => {
      if (value === "sparse") {
        return { ...prev, vector_type: value, dimension: undefined, metric: "dotproduct" };
      }
      return {
        ...prev,
        vector_type: value,
        dimension: prev.dimension ?? 1536,
        metric: "cosine",
      };
    });
    if (value === "sparse") {
      setUseModelDimension(false);
      setSelectedEmbeddingModelId("");
    }
  };

  const handleCloudChange = (value: string) => {
    const regions = REGION_OPTIONS[value] ?? [];
    setCreateForm((prev) => ({
      ...prev,
      cloud: value,
      region: regions[0] ?? "",
    }));
  };

  const handleDimensionModeChange = (mode: "manual" | "model") => {
    const useModel = mode === "model";
    setUseModelDimension(useModel);
    if (useModel) {
      const model = embeddingModels.find((entry) => entry.id === selectedEmbeddingModelId);
      setCreateForm((prev) => ({
        ...prev,
        dimension: typeof model?.dimension === "number" ? model.dimension : undefined,
      }));
      return;
    }
    setCreateForm((prev) => ({
      ...prev,
      dimension: typeof prev.dimension === "number" ? prev.dimension : 1536,
    }));
  };

  const handleSelectEmbeddingModel = (modelId: string) => {
    setSelectedEmbeddingModelId(modelId);
    const model = embeddingModels.find((entry) => entry.id === modelId);
    if (typeof model?.dimension === "number") {
      setCreateForm((prev) => ({ ...prev, dimension: model.dimension }));
    }
  };

  const handleCreate = async () => {
    setCreating(true);
    try {
      const payload: PineconeIndexCreatePayload = {
        ...createForm,
        name: createForm.name.trim(),
      };
      if (payload.vector_type === "sparse") {
        delete payload.dimension;
      } else if (!payload.dimension) {
        /* c8 ignore start -- guarded by disabled Create button */
        onError("Dense indexes require a vector dimension.");
        setCreating(false);
        return;
        /* c8 ignore stop */
      }
      if (useModelDimension && !selectedEmbeddingModelId) {
        /* c8 ignore start -- guarded by disabled Create button */
        onError("Select an embedding model to set the dimension.");
        setCreating(false);
        return;
        /* c8 ignore stop */
      }
      await createPineconeIndex(token, payload);
      setCreateForm((prev) => ({ ...prev, name: "" }));
      onCreated();
    } catch (err) {
      onError(getErrorMessage(err, "Unable to create index."));
    } finally {
      setCreating(false);
    }
  };

  return {
    createForm,
    creating,
    useModelDimension,
    selectedEmbeddingModelId,
    selectedEmbeddingModel,
    createDisabled,
    createDisabledReason,
    setName,
    setMetric,
    setRegion,
    setDimension,
    handleVectorTypeChange,
    handleCloudChange,
    handleDimensionModeChange,
    handleSelectEmbeddingModel,
    handleCreate,
  };
}
