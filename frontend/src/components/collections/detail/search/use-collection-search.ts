"use client";

import { useEffect, useState } from "react";

import { runCollectionQuery } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";

import type { CollectionQueryResult } from "@/lib/types";

const RECENT_LIMIT = 5;

const recentKey = (collectionId: string) => `ragworks:recent-queries:${collectionId}`;
const lastResultKey = (collectionId: string) => `ragworks:last-search:${collectionId}`;

function readRecent(collectionId: string): string[] {
  try {
    const raw = window.localStorage.getItem(recentKey(collectionId));
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((q): q is string => typeof q === "string") : [];
  } catch {
    return [];
  }
}

type StoredSearch = {
  query: string;
  topK: number;
  result: CollectionQueryResult;
};

/** The last completed search, kept for this tab so Back from a trace restores it. */
function readLastSearch(collectionId: string): StoredSearch | null {
  try {
    const raw = window.sessionStorage.getItem(lastResultKey(collectionId));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof (parsed as StoredSearch).query === "string" &&
      typeof (parsed as StoredSearch).topK === "number" &&
      typeof (parsed as StoredSearch).result === "object"
    ) {
      return parsed as StoredSearch;
    }
    return null;
  } catch {
    return null;
  }
}

function writeLastSearch(collectionId: string, stored: StoredSearch): void {
  try {
    window.sessionStorage.setItem(lastResultKey(collectionId), JSON.stringify(stored));
  } catch {
    // Restoring results is a convenience; storage being unavailable is fine.
  }
}

export type CollectionSearchState = {
  query: string;
  setQuery: (query: string) => void;
  topK: number;
  setTopK: (topK: number) => void;
  result: CollectionQueryResult | null;
  running: boolean;
  error: string | null;
  recentQueries: string[];
  run: (query?: string) => Promise<void>;
};

/**
 * Query composer state: run retrieval, remember recent queries locally, and
 * restore the last result set when the page remounts in the same tab — so
 * navigating into a trace and back never loses the results being inspected.
 */
export function useCollectionSearch(token: string, collectionId: string): CollectionSearchState {
  const [query, setQuery] = useState("");
  const [topK, setTopK] = useState(5);
  const [result, setResult] = useState<CollectionQueryResult | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recentQueries, setRecentQueries] = useState<string[]>([]);

  // Hydrate recents and the last result set after mount — never read Web
  // Storage during render.
  useEffect(() => {
    setRecentQueries(readRecent(collectionId));
    const stored = readLastSearch(collectionId);
    if (stored) {
      setQuery(stored.query);
      setTopK(stored.topK);
      setResult(stored.result);
    }
  }, [collectionId]);

  const run = async (override?: string) => {
    const text = (override ?? query).trim();
    if (!text || running) return;
    if (override !== undefined) {
      setQuery(override);
    }
    setRunning(true);
    setError(null);
    try {
      const response = await runCollectionQuery(token, collectionId, {
        query: text,
        top_k: topK,
      });
      setResult(response);
      writeLastSearch(collectionId, { query: text, topK, result: response });
      const nextRecent = [text, ...readRecent(collectionId).filter((q) => q !== text)].slice(
        0,
        RECENT_LIMIT,
      );
      setRecentQueries(nextRecent);
      try {
        window.localStorage.setItem(recentKey(collectionId), JSON.stringify(nextRecent));
      } catch {
        // Recents are a convenience; storage being unavailable is fine.
      }
    } catch (err) {
      setError(getErrorMessage(err, "Query failed."));
    } finally {
      setRunning(false);
    }
  };

  return { query, setQuery, topK, setTopK, result, running, error, recentQueries, run };
}
