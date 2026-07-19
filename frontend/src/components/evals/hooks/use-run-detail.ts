"use client";

import { useCallback, useEffect, useState } from "react";

import { isRunActive } from "@/components/evals/lib/metrics";
import {
  cancelEvalRun,
  fetchEvalDataset,
  fetchEvalMetricCatalog,
  fetchEvalRun,
  fetchEvalRunItems,
  fetchPipelines,
} from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { useApiQuery } from "@/lib/use-api-query";
import { useAuth } from "@/providers/auth-provider";

const ACTIVE_POLL_MS = 2000;

/** One eval run's live state: the run, its items, naming context, and cancel. */
export function useRunDetail(runId: string) {
  const { token } = useAuth();
  const [actionError, setActionError] = useState<string | null>(null);

  const run = useApiQuery(() => fetchEvalRun(token!, runId), [token, runId], {
    enabled: !!token,
  });
  const items = useApiQuery(() => fetchEvalRunItems(token!, runId), [token, runId], {
    enabled: !!token,
  });
  const metricCatalog = useApiQuery(() => fetchEvalMetricCatalog(token!), [token], {
    enabled: !!token,
  });
  const datasetId = run.data?.dataset_id ?? null;
  const dataset = useApiQuery(() => fetchEvalDataset(token!, datasetId!), [token, datasetId], {
    enabled: !!token && !!datasetId,
  });
  const pipelines = useApiQuery(() => fetchPipelines(token!), [token], { enabled: !!token });

  const active = run.data ? isRunActive(run.data.status) : false;

  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => {
      run.reload();
      items.reload();
    }, ACTIVE_POLL_MS);
    return () => window.clearInterval(timer);
  }, [active, run, items]);

  const cancel = useCallback(async () => {
    setActionError(null);
    try {
      await cancelEvalRun(token!, runId);
      run.reload();
    } catch (err) {
      setActionError(getErrorMessage(err, "Could not cancel the run"));
    }
  }, [token, runId, run]);

  return { run, items, metricCatalog, dataset, pipelines, active, cancel, actionError };
}
