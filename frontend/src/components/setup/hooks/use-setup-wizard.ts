"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo, useReducer, useState } from "react";

import {
  initialSetupWizardState,
  setupWizardReducer,
  SUGGESTED_MODEL_FRAGMENT,
} from "@/components/setup/lib/setup-wizard-reducer";
import {
  bootstrapSetup,
  createIndex,
  describeIndex,
  fetchEmbeddingModels,
  fetchIndexBackends,
  updateUserSettings,
} from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { useApiQuery } from "@/lib/use-api-query";
import { useAuth } from "@/providers/auth-provider";
import { useSetupStatus } from "@/providers/setup-status-provider";

import type { SetupChoices, SetupWizardState } from "@/components/setup/lib/setup-wizard-reducer";
import type { BackendInfo, EmbeddingModelInfo } from "@/lib/types";

export interface SetupWizardApi {
  state: SetupWizardState;
  next: () => void;
  back: () => void;
  setChoices: (choices: Partial<SetupChoices>) => void;
  keyConfigured: boolean;
  saveKey: (key: string) => Promise<void>;
  models: EmbeddingModelInfo[] | null;
  modelsLoading: boolean;
  modelsError: string | null;
  backends: BackendInfo[] | null;
  suggestedModelId: string | null;
  /** Saves an optional Pinecone key, creates (or adopts) the index, advances. */
  ensureIndex: (pineconeKey?: string) => Promise<void>;
  /** Installs pipelines + first collection, then lands on the collection. */
  finish: () => Promise<void>;
  busy: boolean;
  error: string | null;
  clearError: () => void;
}

/** One state domain: wizard progression, remote catalogs, and mutations. */
export function useSetupWizard(): SetupWizardApi {
  const { token, user, refreshProfile } = useAuth();
  const { markComplete } = useSetupStatus();
  const router = useRouter();
  const [state, dispatch] = useReducer(setupWizardReducer, "pgvector", initialSetupWizardState);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [keySaved, setKeySaved] = useState(false);

  const keyConfigured = keySaved || Boolean(user?.openrouter_configured);

  const modelsQuery = useApiQuery(() => fetchEmbeddingModels(token ?? ""), [token, keyConfigured], {
    enabled: Boolean(token) && keyConfigured,
  });
  const backendsQuery = useApiQuery(() => fetchIndexBackends(token ?? ""), [token], {
    enabled: Boolean(token),
  });

  const suggestedModelId = useMemo(() => {
    const match = modelsQuery.data?.find((model) =>
      model.id.toLowerCase().includes(SUGGESTED_MODEL_FRAGMENT),
    );
    return match?.id ?? null;
  }, [modelsQuery.data]);

  const setChoices = useCallback(
    (choices: Partial<SetupChoices>) => dispatch({ type: "SET_CHOICES", choices }),
    [],
  );
  const next = useCallback(() => {
    setError(null);
    dispatch({ type: "NEXT" });
  }, []);
  const back = useCallback(() => {
    setError(null);
    dispatch({ type: "BACK" });
  }, []);

  const saveKey = useCallback(
    async (key: string) => {
      if (!token) return;
      setBusy(true);
      setError(null);
      try {
        await updateUserSettings(token, { openrouter_api_key: key });
        await refreshProfile();
        setKeySaved(true);
        dispatch({ type: "NEXT" });
      } catch (err) {
        setError(getErrorMessage(err, "Could not save the API key."));
      } finally {
        setBusy(false);
      }
    },
    [token, refreshProfile],
  );

  const ensureIndex = useCallback(
    async (pineconeKey?: string) => {
      if (!token) return;
      const { backend, indexName, embeddingDimension } = state.choices;
      setBusy(true);
      setError(null);
      try {
        if (pineconeKey?.trim()) {
          await updateUserSettings(token, { pinecone_api_key: pineconeKey.trim() });
          await refreshProfile();
        }
        try {
          await createIndex(token, {
            backend,
            name: indexName,
            dimension: embeddingDimension ?? undefined,
            metric: "cosine",
          });
        } catch (err) {
          // Adopt an existing index only when its dimension matches the model.
          const existing = await describeIndex(token, backend, indexName).catch(() => null);
          if (!existing) throw err;
          if (
            embeddingDimension != null &&
            existing.dimension != null &&
            existing.dimension !== embeddingDimension
          ) {
            throw new Error(
              `Index "${indexName}" already exists with dimension ${existing.dimension}; ` +
                `pick a different name or a ${existing.dimension}-dimension model.`,
            );
          }
        }
        dispatch({ type: "NEXT" });
      } catch (err) {
        setError(getErrorMessage(err, "Could not create the index."));
      } finally {
        setBusy(false);
      }
    },
    [token, state.choices, refreshProfile],
  );

  const finish = useCallback(async () => {
    if (!token) return;
    const { choices } = state;
    setBusy(true);
    setError(null);
    try {
      const result = await bootstrapSetup(token, {
        embedding_model: choices.embeddingModel,
        embedding_dimension: choices.embeddingDimension,
        backend: choices.backend,
        index_name: choices.indexName,
        collection_name: choices.collectionName,
        chunk_size: choices.chunkSize,
        chunk_overlap: choices.chunkOverlap,
      });
      markComplete();
      router.replace(`/collections/${result.collection.id}`);
    } catch (err) {
      setError(getErrorMessage(err, "Could not finish setup."));
      setBusy(false);
    }
  }, [token, state, markComplete, router]);

  return {
    state,
    next,
    back,
    setChoices,
    keyConfigured,
    saveKey,
    models: modelsQuery.data,
    modelsLoading: modelsQuery.loading,
    modelsError: modelsQuery.error,
    backends: backendsQuery.data,
    suggestedModelId,
    ensureIndex,
    finish,
    busy,
    error,
    clearError: () => setError(null),
  };
}
