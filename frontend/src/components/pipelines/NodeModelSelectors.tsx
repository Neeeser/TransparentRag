"use client";

import { useEffect } from "react";

import { modelAvailability } from "@/lib/model-catalog-cache";

import { EmbeddingModelSelectorCard } from "./EmbeddingModelSelectorCard";
import { RERANKER_NODE_TYPE } from "./lib/reranking";
import { RerankingModelSelectorCard } from "./RerankingModelSelectorCard";

import type { CatalogModel, ModelCatalogResponse } from "@/lib/types";

export type NodeModelCatalogProps = {
  embeddingModels: CatalogModel[];
  embeddingCatalog: ModelCatalogResponse | null;
  embeddingModelsLoading: boolean;
  embeddingModelsError: string | null;
  onCatalogVisible?: () => void;
  onSelectEmbeddingModel: (model: CatalogModel) => void;
  rerankingModels: CatalogModel[];
  rerankingCatalog: ModelCatalogResponse | null;
  rerankingModelsLoading: boolean;
  rerankingModelsError: string | null;
  onRerankingCatalogVisible?: () => void;
  onRetryRerankingModels: () => void;
  onSelectRerankingModel: (model: CatalogModel) => void;
};

type NodeModelSelectorsProps = NodeModelCatalogProps & {
  nodeType: string;
  config: Record<string, unknown>;
  embeddingBoundToVariable: boolean;
};

export function NodeModelSelectors({
  nodeType,
  config,
  embeddingBoundToVariable,
  embeddingModels,
  embeddingCatalog,
  embeddingModelsLoading,
  embeddingModelsError,
  onCatalogVisible,
  onSelectEmbeddingModel,
  rerankingModels,
  rerankingCatalog,
  rerankingModelsLoading,
  rerankingModelsError,
  onRerankingCatalogVisible,
  onRetryRerankingModels,
  onSelectRerankingModel,
}: NodeModelSelectorsProps) {
  const isEmbedder = nodeType === "embedder.text";
  const isReranker = nodeType === RERANKER_NODE_TYPE;
  const modelName = typeof config.model_name === "string" ? config.model_name : "";
  const connectionId = typeof config.connection_id === "string" ? config.connection_id : null;

  useEffect(() => {
    if (isEmbedder) onCatalogVisible?.();
  }, [isEmbedder, onCatalogVisible]);
  useEffect(() => {
    if (isReranker) onRerankingCatalogVisible?.();
  }, [isReranker, onRerankingCatalogVisible]);

  if (isEmbedder && !embeddingBoundToVariable) {
    return (
      <EmbeddingModelSelectorCard
        models={embeddingModels}
        selectedModelKey={modelName}
        selectedConnectionId={connectionId}
        selectedAvailability={modelAvailability(embeddingCatalog, connectionId, modelName || null)}
        modelsLoading={embeddingModelsLoading}
        modelsError={embeddingModelsError}
        onSelectModel={onSelectEmbeddingModel}
      />
    );
  }
  if (isReranker) {
    return (
      <RerankingModelSelectorCard
        models={rerankingModels}
        selectedModelKey={modelName}
        selectedConnectionId={connectionId}
        selectedAvailability={modelAvailability(rerankingCatalog, connectionId, modelName || null)}
        modelsLoading={rerankingModelsLoading}
        modelsError={rerankingModelsError}
        onRetry={onRetryRerankingModels}
        onSelectModel={onSelectRerankingModel}
      />
    );
  }
  return null;
}
