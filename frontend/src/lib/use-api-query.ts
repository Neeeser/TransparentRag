"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { getErrorMessage } from "@/lib/errors";

interface UseApiQueryOptions {
  enabled?: boolean;
}

interface UseApiQueryResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

const DEFAULT_ERROR_MESSAGE = "Something went wrong";

export function useApiQuery<T>(
  fn: () => Promise<T>,
  deps: readonly unknown[],
  opts?: UseApiQueryOptions,
): UseApiQueryResult<T> {
  const enabled = opts?.enabled ?? true;

  // fn is captured in a ref so callers can pass inline closures without
  // needing to memoize them; only `deps` (and `enabled`/reload) control refetch.
  // The ref is updated in an effect (not during render) and this effect is
  // declared before the fetch effect below, so it always runs first on a
  // given commit and the fetch effect observes the latest `fn`.
  const fnRef = useRef(fn);
  useEffect(() => {
    fnRef.current = fn;
  });

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const reload = useCallback(() => {
    setReloadToken((token) => token + 1);
  }, []);

  useEffect(() => {
    if (!enabled) {
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fnRef
      .current()
      .then((result) => {
        if (cancelled) return;
        setData(result);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(getErrorMessage(err, DEFAULT_ERROR_MESSAGE));
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // Deps are intentionally forwarded from the caller as a dynamic-length array:
    // this hook's contract is to refetch whenever any of `deps` change (plus
    // `enabled`/`reloadToken`). `fn` itself is excluded on purpose - see fnRef above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, reloadToken, ...deps]);

  return { data, loading, error, reload };
}
