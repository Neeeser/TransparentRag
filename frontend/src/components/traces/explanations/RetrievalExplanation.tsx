import { RankingResultList } from "@/components/traces/explanations/RankingResultList";
import { ResultList } from "@/components/traces/explanations/ResultList";
import {
  embeddingSummary,
  itemLists,
  matchSummary,
  previewTextById,
  rankingSummary,
  summaryValue,
  textSummary,
} from "@/components/traces/explanations/summary-data";

import type { NodeExplanationProps } from "@/components/traces/explanations/types";

const labelClass = "font-mono text-[10px] uppercase tracking-[0.2em] text-meta";

export function RetrievalInputExplanation({ step }: NodeExplanationProps) {
  const query = textSummary(step, "outputs");
  const topK = summaryValue(step, "Top K");
  return (
    <div className="max-w-3xl space-y-4">
      <p className="text-sm leading-relaxed text-body">
        Created the request that every retrieval branch receives.
      </p>
      <div className="rounded-xl border border-hairline bg-surface p-4">
        <div className="flex items-baseline gap-2">
          <p className={labelClass}>Query</p>
          {typeof topK === "number" ? (
            <span className="ml-auto font-mono text-[10px] text-meta">top {topK}</span>
          ) : null}
        </div>
        <p className="mt-2 whitespace-pre-wrap text-base leading-relaxed text-primary">
          {query ? (query.full ?? query.preview) : "Query text was not recorded."}
        </p>
      </div>
    </div>
  );
}

export function QueryEmbedderExplanation({ step, node }: NodeExplanationProps) {
  const query = textSummary(step, "inputs");
  const embedding = embeddingSummary(step, "outputs");
  const dimensions = embedding
    ? "total_values" in embedding
      ? embedding.total_values
      : embedding.dimension
    : null;
  return (
    <div className="max-w-3xl space-y-4">
      <p className="text-sm leading-relaxed text-body">
        Converted the query into a {dimensions ?? "vector"}-dimension embedding for semantic search.
      </p>
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <div className="rounded-xl border border-hairline bg-surface p-4">
          <p className={labelClass}>Query</p>
          <p className="mt-2 text-sm text-primary">{query ? (query.full ?? query.preview) : "—"}</p>
        </div>
        <div className="rounded-xl border border-hairline bg-surface p-4 sm:min-w-44">
          <p className={labelClass}>Embedding</p>
          <p className="mt-2 text-lg font-semibold text-primary">{dimensions ?? "—"} values</p>
          <p className="mt-1 truncate font-mono text-[10px] text-muted">
            {String(node.data.config.model_name ?? "")}
          </p>
        </div>
      </div>
    </div>
  );
}

const retrieverScoreLabel = (nodeType: string): string =>
  nodeType === "retriever.bm25" ? "BM25 score" : "Vector similarity";

const upstreamScoreLabel = (source: string | undefined): string | null => {
  const normalized = source?.toLowerCase() ?? "";
  if (normalized.includes("bm25")) return "BM25 score";
  if (normalized.includes("semantic") || normalized.includes("vector")) {
    return "Vector similarity";
  }
  if (normalized.includes("rrf") || normalized.includes("fusion")) return "RRF score";
  if (normalized.includes("rerank")) return "Cross-encoder score";
  return null;
};

export function RetrieverExplanation(props: NodeExplanationProps) {
  if (rankingSummary(props.step, "outputs")) return <GenericRankingExplanation {...props} />;
  const matches = itemLists(props.step, "outputs")[0]?.list;
  if (!matches) return null;
  const scoreLabel = retrieverScoreLabel(props.node.data.nodeType);
  return (
    <div className="space-y-4">
      <p className="text-sm leading-relaxed text-body">
        Returned {matches.items.length} candidates ordered by {scoreLabel.toLowerCase()}.
      </p>
      <ResultList
        title={props.node.data.label}
        ariaLabel={`${scoreLabel.replace(" score", "")} ranking`}
        items={matches.items}
        scoreLabel={scoreLabel}
        focusedItemId={props.focusedItemId}
        contextItems={props.contextItems}
        previews={previewTextById(matchSummary(props.step, "outputs"))}
        onFocusItem={props.onFocusItem}
        onOpenArtifact={props.onOpenArtifact}
      />
    </div>
  );
}

export function FusionExplanation(props: NodeExplanationProps) {
  const branches = itemLists(props.step, "inputs");
  const fused = itemLists(props.step, "outputs")[0]?.list;
  const ranking = rankingSummary(props.step, "outputs");
  const k = props.node.data.config.k;
  if (!fused) return null;
  if (ranking) {
    return (
      <div className="space-y-4">
        <p className="text-sm leading-relaxed text-body">
          Combined branch ranks without comparing their raw scores.
        </p>
        <RankingResultList
          title="Fused ranking"
          evidence={ranking}
          focusedItemId={props.focusedItemId}
          contextItems={props.contextItems}
          previews={previewTextById(matchSummary(props.step, "outputs"))}
          sourceLabels={props.inputSources}
          sourceScoreLabels={props.inputSources.map(upstreamScoreLabel)}
          onFocusItem={props.onFocusItem}
          onOpenArtifact={props.onOpenArtifact}
        />
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline gap-2">
        <p className="text-sm leading-relaxed text-body">
          Combined branch ranks without comparing their raw scores.
        </p>
        <span className="font-mono text-[10px] text-meta">
          contribution = 1 / ({String(k ?? 60)} + rank)
        </span>
      </div>
      <div className="grid gap-3 xl:grid-cols-2">
        {branches.map((branch, index) => {
          const source = props.inputSources[index] ?? `Branch ${index + 1}`;
          return (
            <ResultList
              key={branch.label}
              title={source}
              ariaLabel={`${source} ranking`}
              items={branch.list.items}
              scoreLabel={upstreamScoreLabel(source) ?? "Source score"}
              focusedItemId={props.focusedItemId}
              contextItems={props.contextItems}
              onFocusItem={props.onFocusItem}
              onOpenArtifact={props.onOpenArtifact}
              compact
            />
          );
        })}
      </div>
      <ResultList
        title="Fused ranking"
        ariaLabel="Fused ranking"
        items={fused.items}
        scoreLabel="RRF score"
        focusedItemId={props.focusedItemId}
        contextItems={props.contextItems}
        onFocusItem={props.onFocusItem}
        onOpenArtifact={props.onOpenArtifact}
      />
    </div>
  );
}

export function GenericRankingExplanation(props: NodeExplanationProps) {
  const ranking = rankingSummary(props.step, "outputs");
  if (!ranking) return null;
  return (
    <div className="space-y-4">
      <p className="text-sm leading-relaxed text-body">
        Produced an ordered result set with recorded source evidence.
      </p>
      <RankingResultList
        title={`${props.node.data.label} ranking`}
        evidence={ranking}
        focusedItemId={props.focusedItemId}
        contextItems={props.contextItems}
        previews={previewTextById(matchSummary(props.step, "outputs"))}
        sourceLabels={props.inputSources}
        sourceScoreLabels={props.inputSources.map(upstreamScoreLabel)}
        onFocusItem={props.onFocusItem}
        onOpenArtifact={props.onOpenArtifact}
      />
    </div>
  );
}

export function RetrievalOutputExplanation(props: NodeExplanationProps) {
  const results = itemLists(props.step, "outputs")[0]?.list;
  if (!results) return null;
  const scoreLabel = upstreamScoreLabel(props.inputSources[0]) ?? "Final node score";
  return (
    <div className="space-y-4">
      <p className="text-sm leading-relaxed text-body">
        Returned the final ordered results to the query API.
      </p>
      <ResultList
        title="Output ranking"
        ariaLabel="Output ranking"
        items={results.items}
        scoreLabel={scoreLabel}
        focusedItemId={props.focusedItemId}
        contextItems={props.contextItems}
        previews={previewTextById(matchSummary(props.step, "outputs"))}
        onFocusItem={props.onFocusItem}
        onOpenArtifact={props.onOpenArtifact}
      />
    </div>
  );
}

export function RerankerExplanation(props: NodeExplanationProps) {
  if (rankingSummary(props.step, "outputs")) return <GenericRankingExplanation {...props} />;
  const before = itemLists(props.step, "inputs")[0]?.list;
  const after = itemLists(props.step, "outputs")[0]?.list;
  if (!before || !after) return null;
  return (
    <div className="grid gap-3 xl:grid-cols-2">
      <ResultList
        title="Before reranking"
        ariaLabel="Before reranking"
        items={before.items}
        scoreLabel="Input score"
        focusedItemId={props.focusedItemId}
        contextItems={props.contextItems}
        onFocusItem={props.onFocusItem}
        onOpenArtifact={props.onOpenArtifact}
        compact
      />
      <ResultList
        title="After reranking"
        ariaLabel="After reranking"
        items={after.items}
        scoreLabel="Cross-encoder score"
        focusedItemId={props.focusedItemId}
        contextItems={props.contextItems}
        onFocusItem={props.onFocusItem}
        onOpenArtifact={props.onOpenArtifact}
        compact
      />
    </div>
  );
}
