"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { TextArea, TextInput } from "@/components/ui/field";
import { GlassCard } from "@/components/ui/panel";
import { runCollectionQuery } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { truncate } from "@/lib/utils";

import type { CollectionQueryResult } from "@/lib/types";
import type { FormEvent } from "react";

type CollectionSearchProps = {
  collectionId: string;
  token: string;
};

export function CollectionSearch({ collectionId, token }: CollectionSearchProps) {
  const router = useRouter();
  const [query, setQuery] = useState("What does this collection contain?");
  const [topK, setTopK] = useState(4);
  const [queryResult, setQueryResult] = useState<CollectionQueryResult | null>(null);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleQuery = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!query.trim()) return;
    setWorking(true);
    setMessage(null);
    try {
      const result = await runCollectionQuery(token, collectionId, { query, top_k: topK });
      setQueryResult(result);
    } catch (error) {
      setMessage(getErrorMessage(error, "Query failed."));
    } finally {
      setWorking(false);
    }
  };

  // Targeting a chunk makes the debugger join retrieval with the ingestion
  // run that produced it — the whole document → chunk → index → query path.
  const openTrace = (chunkId?: string | null) => {
    if (!queryResult?.query_event_id) {
      setMessage("Trace is not available for this query.");
      return;
    }
    const chunkParam = chunkId ? `?chunk=${encodeURIComponent(chunkId)}` : "";
    router.push(`/traces/queries/${queryResult.query_event_id}${chunkParam}`);
  };

  const topScores = useMemo(() => {
    if (!queryResult?.chunks?.length) return { max: 0 };
    const max = Math.max(...queryResult.chunks.map((chunk) => chunk.score ?? 0));
    return { max };
  }, [queryResult]);

  return (
    <div className="space-y-6">
      <GlassCard className="rounded-3xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.35em] text-muted">
              Retriever
            </p>
            <h2 className="text-2xl font-semibold text-primary">Transparent similarity search</h2>
            <p className="text-sm text-muted">
              Run the retrieval pipeline against this collection.
            </p>
          </div>
          <Search className="h-5 w-5 text-accent-violet" />
        </div>
        {message && (
          <div className="mt-4 rounded-2xl border border-data-neg/30 bg-data-neg/10 p-3 text-sm text-data-neg">
            {message}
          </div>
        )}
        <form className="mt-4 space-y-4" onSubmit={handleQuery}>
          <TextArea
            className="min-h-[120px]"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <div className="flex flex-wrap items-center gap-3 text-sm text-body">
            <label
              htmlFor="topk"
              className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted"
            >
              Top K
            </label>
            <TextInput
              id="topk"
              type="number"
              min={1}
              max={12}
              value={topK}
              onChange={(event) => setTopK(Number(event.target.value))}
              className="w-20 px-3 py-2 text-center"
            />
            <Button type="submit" loading={working}>
              Run query
            </Button>
          </div>
        </form>
      </GlassCard>

      <GlassCard className="rounded-3xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.35em] text-muted">Results</p>
            <h2 className="text-2xl font-semibold text-primary">Retrieved chunks</h2>
          </div>
          <span className="text-sm text-muted">{queryResult?.chunks?.length ?? 0} matches</span>
        </div>

        <div className="mt-6 space-y-4">
          {!queryResult && <p className="text-sm text-muted">No queries yet.</p>}
          {queryResult && (
            <div className="flex flex-wrap items-center gap-3 text-sm text-body">
              <Button variant="secondary" size="sm" onClick={() => openTrace()}>
                View retrieval trace
              </Button>
              {queryResult.query_event_id && (
                <span className="text-xs text-muted">
                  Query event: {queryResult.query_event_id}
                </span>
              )}
            </div>
          )}
          {queryResult?.chunks?.map((chunk) => (
            <div
              key={`${chunk.chunk_id ?? chunk.id}-${chunk.chunk_index}-${chunk.score}`}
              className="rounded-2xl border border-hairline p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted">
                  score {(chunk.score ?? 0).toFixed(3)}
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => openTrace((chunk.chunk_id ?? chunk.id) as string)}
                >
                  Trace result
                </Button>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="h-2 w-32 rounded-full bg-surface-strong">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-accent-violet to-accent-cyan"
                    style={{
                      width: `${topScores.max ? ((chunk.score ?? 0) / topScores.max) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
              <p className="mt-3 text-sm text-body">{truncate(chunk.text ?? "", 320)}</p>
              {chunk.metadata && (
                <p className="mt-2 text-xs text-muted">
                  {Object.entries(chunk.metadata)
                    .slice(0, 3)
                    .map(([key, value]) => `${key}: ${value}`)
                    .join(" | ")}
                </p>
              )}
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}
