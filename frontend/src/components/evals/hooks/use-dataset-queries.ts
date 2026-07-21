"use client";

import { useCallback, useState } from "react";

import { deleteEvalDatasetQuery, fetchEvalDatasetQueries, updateEvalDatasetQuery } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { useApiQuery } from "@/lib/use-api-query";
import { useAuth } from "@/providers/auth-provider";

export const DATASET_QUERIES_PAGE_SIZE = 50;

/** One dataset's paged query list plus the edit/delete curation actions. */
export function useDatasetQueries(datasetId: string) {
  const { token } = useAuth();
  const [offset, setOffset] = useState(0);
  const [actionError, setActionError] = useState<string | null>(null);

  const page = useApiQuery(
    () =>
      fetchEvalDatasetQueries(token!, datasetId, {
        offset,
        limit: DATASET_QUERIES_PAGE_SIZE,
      }),
    [token, datasetId, offset],
    { enabled: !!token },
  );

  const reload = page.reload;
  const runAction = useCallback(
    async (action: () => Promise<unknown>) => {
      setActionError(null);
      try {
        await action();
        reload();
        return true;
      } catch (err) {
        setActionError(getErrorMessage(err, "The request failed"));
        return false;
      }
    },
    [reload],
  );

  const saveQueryText = useCallback(
    (queryId: string, text: string) =>
      runAction(() => updateEvalDatasetQuery(token!, datasetId, queryId, text)),
    [runAction, token, datasetId],
  );

  const removeQuery = useCallback(
    (queryId: string) => runAction(() => deleteEvalDatasetQuery(token!, datasetId, queryId)),
    [runAction, token, datasetId],
  );

  return { page, offset, setOffset, actionError, saveQueryText, removeQuery };
}
