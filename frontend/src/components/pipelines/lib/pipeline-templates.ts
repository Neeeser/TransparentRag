/**
 * Pipeline starting-point templates for the create-tool wizard.
 *
 * A template is a named scaffold: it produces a full `PipelineDefinition` and
 * declares what the wizard must collect for it (an embedding model, a
 * reranking provider) and which backend capability it needs. The semantic
 * templates build on the shared hybrid scaffold in `pipeline-scaffold.ts`;
 * the aggregate (count/facet) templates are their own small graphs. New
 * templates are added here — the wizard renders from this catalog.
 */
import {
  BM25_RETRIEVER_NODE_TYPE,
  bm25SiblingIndexName,
  buildDefaultDefinition,
  LIMIT_NODE_TYPE,
  RETRIEVER_NODE_TYPE,
} from "./pipeline-scaffold";

import type { BackendInfo, IndexBackend, PipelineDefinition } from "@/lib/types";

/** A backend capability a template's data plane requires. */
export type TemplateCapability = "lexical_count" | "lexical_facet";

export type TemplateBuildOptions = {
  indexName?: string;
  indexDimension?: number;
  embeddingConnectionId?: string;
  embeddingModel?: string;
  /** Scaffold the parallel BM25 branch (semantic templates on lexical backends). */
  includeBm25?: boolean;
  indexNameMaxLength?: number;
};

export type PipelineTemplate = {
  id: string;
  label: string;
  description: string;
  /** Semantic templates embed the query; aggregate (count/facet) ones don't. */
  needsEmbedding: boolean;
  /** The reranked template needs a configured reranking provider. */
  needsReranker: boolean;
  /** Backend capability this template's aggregate node requires, if any. */
  requiredCapability: TemplateCapability | null;
  build: (backend: IndexBackend, options: TemplateBuildOptions) => PipelineDefinition;
};

const RERANKER_NODE_TYPE = "reranker.model";
const RERANK_NODE_ID = "rerank-results";
const RETRIEVAL_OUTPUT_TYPE = "retrieval.output";
// The reranked template over-fetches so the reranker reorders a wider set
// than the final result_limit keeps — reranking after the cut would only
// reorder chunks already chosen.
const OVERFETCH_MULTIPLIER = 3;

/**
 * Insert a reranker into a hybrid/dense retrieval definition, just upstream of
 * the cut point (the result-limit node when present, else the output). When a
 * limit exists, retriever fetch depth is widened to `result_limit * N` so the
 * reranker has extra candidates to reorder before the limit trims back.
 */
function withReranker(definition: PipelineDefinition): PipelineDefinition {
  const limitNode = definition.nodes.find((node) => node.type === LIMIT_NODE_TYPE);
  const target = limitNode ?? definition.nodes.find((node) => node.type === RETRIEVAL_OUTPUT_TYPE);
  if (!target) return definition;

  const nodes = definition.nodes.map((node) => {
    const isRetriever = node.type === RETRIEVER_NODE_TYPE || node.type === BM25_RETRIEVER_NODE_TYPE;
    if (limitNode && isRetriever) {
      return {
        ...node,
        config: { ...node.config, top_k: { $expr: `result_limit * ${OVERFETCH_MULTIPLIER}` } },
      };
    }
    return node;
  });
  nodes.push({ id: RERANK_NODE_ID, type: RERANKER_NODE_TYPE, name: "Reranker", config: {} });

  const edges = definition.edges.map((edge) =>
    edge.target === target.id ? { ...edge, target: RERANK_NODE_ID } : edge,
  );
  edges.push({
    id: "edge-reranker-target",
    source: RERANK_NODE_ID,
    target: target.id,
    source_port: "results",
    target_port: "results",
  });
  return { ...definition, nodes, edges };
}

/** Build a structured aggregate graph: query input → BM25 aggregate → tool output. */
function buildAggregateDefinition(
  aggregateType: "count.bm25" | "facet.bm25",
  identity: { toolName: string; toolDescription: string; nodeLabel: string },
  backend: IndexBackend,
  options: TemplateBuildOptions,
): PipelineDefinition {
  const indexName = options.indexName?.trim();
  const aggregateConfig: Record<string, unknown> = { backend };
  if (indexName) {
    // Aggregate tools read the collection's BM25 sibling index (populated by
    // the hybrid ingestion pipeline), derived from the selected dense index.
    aggregateConfig.index_name = bm25SiblingIndexName(indexName, options.indexNameMaxLength);
  }
  return {
    nodes: [
      {
        id: "query-input",
        type: "retrieval.input",
        name: "Query",
        config: { tool_name: identity.toolName, tool_description: identity.toolDescription },
      },
      { id: "aggregate", type: aggregateType, name: identity.nodeLabel, config: aggregateConfig },
      { id: "tool-output", type: "tool.output", name: "Tool Output", config: {} },
    ],
    edges: [
      {
        id: "edge-input-aggregate",
        source: "query-input",
        target: "aggregate",
        source_port: "request",
        target_port: "request",
      },
      {
        id: "edge-aggregate-output",
        source: "aggregate",
        target: "tool-output",
        source_port: "values",
        target_port: "values",
      },
    ],
    viewport: {},
  };
}

export const PIPELINE_TEMPLATES: PipelineTemplate[] = [
  {
    id: "semantic-keyword",
    label: "Semantic + keyword search",
    description:
      "Dense vector search fused with BM25 keyword matching. Returns ranked chunks — the default search tool.",
    needsEmbedding: true,
    needsReranker: false,
    requiredCapability: null,
    build: (backend, options) => buildDefaultDefinition("retrieval", backend, options),
  },
  {
    id: "reranked",
    label: "Reranked search",
    description:
      "Hybrid search that over-fetches candidates and reorders them with a reranking model for higher precision.",
    needsEmbedding: true,
    needsReranker: true,
    requiredCapability: null,
    build: (backend, options) =>
      withReranker(buildDefaultDefinition("retrieval", backend, options)),
  },
  {
    id: "count",
    label: "Count matches",
    description:
      "Counts how many documents and chunks lexically match the query. Returns numbers, not ranked chunks.",
    needsEmbedding: false,
    needsReranker: false,
    requiredCapability: "lexical_count",
    build: (backend, options) =>
      buildAggregateDefinition(
        "count.bm25",
        {
          toolName: "count_matches",
          toolDescription: "Count documents and chunks that lexically match the query terms.",
          nodeLabel: "Count",
        },
        backend,
        options,
      ),
  },
  {
    id: "facet",
    label: "Facet by source",
    description:
      "Groups matching chunks by source file, with per-file document and chunk counts. Returns a breakdown.",
    needsEmbedding: false,
    needsReranker: false,
    requiredCapability: "lexical_facet",
    build: (backend, options) =>
      buildAggregateDefinition(
        "facet.bm25",
        {
          toolName: "facet_matches",
          toolDescription: "Group matching chunks by source file with document and chunk counts.",
          nodeLabel: "Facet",
        },
        backend,
        options,
      ),
  },
];

export function templateById(id: string): PipelineTemplate | undefined {
  return PIPELINE_TEMPLATES.find((template) => template.id === id);
}

/** Whether a backend satisfies a template's required data-plane capability. */
export function backendSupportsTemplate(template: PipelineTemplate, backend: BackendInfo): boolean {
  if (template.requiredCapability === "lexical_count") {
    return backend.capabilities.supports_lexical_count;
  }
  if (template.requiredCapability === "lexical_facet") {
    return backend.capabilities.supports_lexical_facet;
  }
  return true;
}
