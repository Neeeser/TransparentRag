"use client";

import { useCallback } from "react";

import { useConnections } from "@/components/connections/hooks/use-connections";

import {
  RERANKER_PROVIDER_ERROR,
  RERANKER_PROVIDER_LOADING,
  RERANKER_PROVIDER_REQUIRED,
} from "../lib/reranking";

import { useEmbeddingModelCatalog } from "./use-embedding-model-catalog";
import { useRerankingModelCatalog } from "./use-reranking-model-catalog";

import type { UUID } from "@/lib/types";

/** Model catalogs and provider availability used by the pipeline editor. */
export function usePipelineModelCatalogs(token: string | null, userId?: UUID | null) {
  const { refreshModels: refreshEmbeddingModels, ...embedding } = useEmbeddingModelCatalog(
    token,
    userId,
  );
  const { refreshModels: refreshRerankingModels, ...reranking } = useRerankingModelCatalog(
    token,
    userId,
  );
  const { connectionsLoading, connectionsResolved, connectionsError, hasKind } = useConnections(
    token ?? "",
    !token,
  );
  const connectionsPending = connectionsLoading || !connectionsResolved;
  const hasRerankingProvider = !connectionsPending && !connectionsError && hasKind("reranking");
  const rerankingProviderMessage = connectionsError
    ? RERANKER_PROVIDER_ERROR
    : connectionsPending
      ? RERANKER_PROVIDER_LOADING
      : hasRerankingProvider
        ? null
        : RERANKER_PROVIDER_REQUIRED;
  const onEmbeddingCatalogVisible = useCallback(
    () => void refreshEmbeddingModels(),
    [refreshEmbeddingModels],
  );
  const onRerankingCatalogVisible = useCallback(
    () => void refreshRerankingModels(),
    [refreshRerankingModels],
  );
  const onRetryRerankingModels = useCallback(
    () => void refreshRerankingModels(),
    [refreshRerankingModels],
  );

  return {
    ...embedding,
    ...reranking,
    hasRerankingProvider,
    rerankingProviderMessage,
    onEmbeddingCatalogVisible,
    onRerankingCatalogVisible,
    onRetryRerankingModels,
  };
}
