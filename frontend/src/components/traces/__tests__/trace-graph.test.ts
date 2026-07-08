import { describe, expect, it } from "vitest";

import { buildTraceGraph } from "@/components/traces/trace-graph";
import { makeNodeRunTrace, makeNodeSpec, makeTraceResponse } from "@/test/fixtures";

import type { PipelineTraceResponse } from "@/lib/types";

const INDEXER_TYPE = "indexer.vector";
const RETRIEVER_TYPE = "retriever.vector";
const INGEST_RUN = "ingest-run";

const nodeSpecs = [
  makeNodeSpec({ type: INDEXER_TYPE, category: "ingestion" }),
  makeNodeSpec({ type: RETRIEVER_TYPE, category: "retrieval" }),
];

const ingestionTrace = (): PipelineTraceResponse =>
  makeTraceResponse({
    run: { ...makeTraceResponse().run, id: INGEST_RUN, kind: "ingestion" },
    definition: {
      nodes: [
        { id: "parse", type: "parser.document", name: "Parser", config: {} },
        { id: "index", type: INDEXER_TYPE, name: "Indexer", config: {} },
      ],
      edges: [{ id: "e", source: "parse", target: "index" }],
    },
    node_runs: [
      makeNodeRunTrace({ id: "r1", run_id: INGEST_RUN, node_id: "parse", sequence_index: 0 }),
      makeNodeRunTrace({ id: "r2", run_id: INGEST_RUN, node_id: "index", sequence_index: 1 }),
    ],
  });

const retrievalTrace = (): PipelineTraceResponse =>
  makeTraceResponse({
    definition: {
      nodes: [
        { id: "retrieve", type: RETRIEVER_TYPE, name: "Retriever", config: {} },
        { id: "out", type: "retrieval.output", name: "Output", config: {} },
      ],
      edges: [{ id: "e", source: "retrieve", target: "out" }],
    },
    node_runs: [
      makeNodeRunTrace({ id: "r3", node_id: "retrieve", sequence_index: 0 }),
      makeNodeRunTrace({ id: "r4", node_id: "out", sequence_index: 1 }),
    ],
  });

describe("buildTraceGraph", () => {
  it("returns just the retrieval graph when there is no origin", () => {
    const graph = buildTraceGraph(retrievalTrace(), null, nodeSpecs);

    expect(graph.combined).toBe(false);
    expect(graph.steps.map((step) => step.stage)).toEqual(["retrieval", "retrieval"]);
    expect(graph.edges.some((edge) => edge.id === "handoff::index")).toBe(false);
  });

  it("joins ingestion and retrieval into one prefixed, ordered flow", () => {
    const graph = buildTraceGraph(retrievalTrace(), ingestionTrace(), nodeSpecs);

    expect(graph.combined).toBe(true);
    // Ingestion steps come first, then retrieval — the end-to-end order.
    expect(graph.steps.map((step) => step.stage)).toEqual([
      "origin",
      "origin",
      "retrieval",
      "retrieval",
    ]);
    // Node ids are prefixed per stage so the two graphs never collide.
    expect(graph.nodes.every((node) => /^(origin|retrieval)::/.test(node.id))).toBe(true);
    // A hand-off wire connects the ingestion indexer to the retrieval retriever.
    const handoff = graph.edges.find((edge) => edge.id === "handoff::index");
    expect(handoff).toBeDefined();
    expect(handoff?.source).toBe("origin::index");
    expect(handoff?.target).toBe("retrieval::retrieve");
  });

  it("stacks the retrieval band below the ingestion band", () => {
    const graph = buildTraceGraph(retrievalTrace(), ingestionTrace(), nodeSpecs);
    const originMaxY = Math.max(
      ...graph.nodes.filter((n) => n.id.startsWith("origin::")).map((n) => n.position.y),
    );
    const retrievalMinY = Math.min(
      ...graph.nodes.filter((n) => n.id.startsWith("retrieval::")).map((n) => n.position.y),
    );
    expect(retrievalMinY).toBeGreaterThan(originMaxY);
  });

  it("resolves each step's run and stage label", () => {
    const graph = buildTraceGraph(retrievalTrace(), ingestionTrace(), nodeSpecs);
    const first = graph.steps[0];
    expect(first.run?.node_id).toBe("parse");
    expect(first.stageLabel).toBe("Ingestion · origin");
    expect(graph.steps.at(-1)?.stageLabel).toBe("Retrieval");
  });
});
