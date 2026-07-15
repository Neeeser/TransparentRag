import { describe, expect, it } from "vitest";

import { buildJourney, buildJourneyFocus } from "@/components/traces/lib/journey";
import { makeNodeRunTrace } from "@/test/fixtures";

import type { TraceGraph, TraceStep } from "@/components/traces/trace-graph";
import type { ItemListTrace, PipelineNodeSummaryValue } from "@/lib/types";

const FOCUSED_ID = "doc:1";
const CHUNK_ROLE = "chunks";
const MATCH_ROLE = "matches";
const CHUNK_ITEMS_LABEL = "Chunk items";
const MATCH_ITEMS_LABEL = "Match items";

const items = (
  label: string,
  kind: ItemListTrace["kind"],
  refs: Array<[string, number | null]>,
): PipelineNodeSummaryValue => ({
  label,
  kind: "items",
  value: {
    kind,
    items: refs.map(([id, score]) => ({ id, score })),
  },
});

const step = (
  nodeId: string,
  nodeName: string,
  inputs: PipelineNodeSummaryValue[],
  outputs: PipelineNodeSummaryValue[],
): TraceStep => ({
  nodeIds: [nodeId],
  nodeId,
  run: makeNodeRunTrace({
    node_id: nodeId,
    node_name: nodeName,
    summary: { inputs, outputs },
  }),
  io: { inputs: [], outputs: [] },
  stage: "retrieval",
  stageLabel: "Retrieval",
});

const graph = (steps: TraceStep[]): TraceGraph => ({
  nodes: [],
  edges: [],
  steps,
  combined: false,
});

describe("buildJourney", () => {
  it("derives created, passed, and dropped effects through a linear flow", () => {
    const trace = graph([
      step("chunk", "Chunker", [], [items(CHUNK_ITEMS_LABEL, CHUNK_ROLE, [[FOCUSED_ID, null]])]),
      step(
        "embed",
        "Embedder",
        [items(CHUNK_ITEMS_LABEL, CHUNK_ROLE, [[FOCUSED_ID, null]])],
        [items("Embedded items", CHUNK_ROLE, [[FOCUSED_ID, null]])],
      ),
      step(
        "filter",
        "Filter",
        [items("Input items", MATCH_ROLE, [[FOCUSED_ID, 0.8]])],
        [items("Output items", MATCH_ROLE, [])],
      ),
    ]);

    expect(buildJourney(trace, FOCUSED_ID)).toEqual([
      {
        nodeId: "chunk",
        nodeName: "Chunker",
        role: CHUNK_ROLE,
        rank: 1,
        score: null,
        delta: null,
        effect: "created",
      },
      {
        nodeId: "embed",
        nodeName: "Embedder",
        role: CHUNK_ROLE,
        rank: 1,
        score: null,
        delta: 0,
        effect: "passed",
      },
      {
        nodeId: "filter",
        nodeName: "Filter",
        role: MATCH_ROLE,
        rank: 1,
        score: 0.8,
        delta: null,
        effect: "dropped",
      },
    ]);
  });

  it("distinguishes an introduced retrieval match from an absent branch", () => {
    const trace = graph([
      step(
        "dense",
        "Dense retriever",
        [],
        [items(MATCH_ITEMS_LABEL, MATCH_ROLE, [[FOCUSED_ID, 0.74]])],
      ),
      step("bm25", "BM25 retriever", [], [items(MATCH_ITEMS_LABEL, MATCH_ROLE, [])]),
    ]);

    expect(buildJourney(trace, FOCUSED_ID)).toEqual([
      expect.objectContaining({ nodeId: "dense", effect: "introduced", rank: 1, score: 0.74 }),
      expect.objectContaining({
        nodeId: "bm25",
        effect: "absent",
        rank: null,
        score: null,
      }),
    ]);
  });

  it("derives merge branch provenance and rerank improvement", () => {
    const trace = graph([
      step(
        "fusion",
        "RRF fusion",
        [
          items("Branch 1 items", MATCH_ROLE, []),
          items("Branch 2 items", MATCH_ROLE, [
            ["other", 0.6],
            [FOCUSED_ID, 0.5],
          ]),
        ],
        [items("Fused items", MATCH_ROLE, [[FOCUSED_ID, 0.82]])],
      ),
      step(
        "rerank",
        "Reranker",
        [
          items("Original items", MATCH_ROLE, [
            ["a", 0.9],
            ["b", 0.8],
            ["c", 0.7],
            [FOCUSED_ID, 0.6],
          ]),
        ],
        [
          items("Reranked items", MATCH_ROLE, [
            ["a", 0.95],
            [FOCUSED_ID, 0.91],
          ]),
        ],
      ),
    ]);

    expect(buildJourney(trace, FOCUSED_ID)).toEqual([
      expect.objectContaining({
        nodeId: "fusion",
        effect: "merged",
        rank: 1,
        score: 0.82,
        delta: 1,
      }),
      expect.objectContaining({
        nodeId: "rerank",
        effect: "reordered",
        rank: 2,
        score: 0.91,
        delta: 2,
      }),
    ]);
  });

  it("keeps combined graph node prefixes intact", () => {
    const trace = graph([
      step(
        "origin::chunk",
        "Chunker",
        [],
        [items(CHUNK_ITEMS_LABEL, CHUNK_ROLE, [[FOCUSED_ID, null]])],
      ),
      step(
        "retrieval::dense",
        "Retriever",
        [],
        [items(MATCH_ITEMS_LABEL, MATCH_ROLE, [[FOCUSED_ID, 0.7]])],
      ),
    ]);

    expect(buildJourney(trace, FOCUSED_ID).map((entry) => entry.nodeId)).toEqual([
      "origin::chunk",
      "retrieval::dense",
    ]);
  });

  it("returns no journey without a focused id", () => {
    expect(buildJourney(graph([]), null)).toEqual([]);
  });
});

describe("buildJourneyFocus", () => {
  it("tints traveled edges, includes the shared index handoff, and dims absent branches", () => {
    const trace: TraceGraph = {
      nodes: [
        {
          id: "a",
          type: "pipelineNode",
          position: { x: 0, y: 0 },
          data: { label: "A", nodeType: "indexer.vector", inputs: [], outputs: [], config: {} },
        },
        {
          id: "store",
          type: "indexStore",
          position: { x: 0, y: 0 },
          data: { label: "Store", nodeType: "store", inputs: [], outputs: [], config: {} },
        },
        {
          id: "b",
          type: "pipelineNode",
          position: { x: 0, y: 0 },
          data: { label: "B", nodeType: "retriever.vector", inputs: [], outputs: [], config: {} },
        },
        {
          id: "absent",
          type: "pipelineNode",
          position: { x: 0, y: 0 },
          data: { label: "Miss", nodeType: "retriever.bm25", inputs: [], outputs: [], config: {} },
        },
      ],
      edges: [
        { id: "write", type: "typed", source: "a", target: "store" },
        { id: "read", type: "typed", source: "store", target: "b" },
        { id: "miss", type: "typed", source: "absent", target: "b" },
      ],
      steps: [],
      combined: true,
    };
    const focus = buildJourneyFocus(trace, [
      {
        nodeId: "a",
        nodeName: "Indexer",
        role: CHUNK_ROLE,
        rank: 1,
        score: null,
        delta: 0,
        effect: "passed",
      },
      {
        nodeId: "b",
        nodeName: "Retriever",
        role: MATCH_ROLE,
        rank: 2,
        score: 0.7,
        delta: null,
        effect: "introduced",
      },
      {
        nodeId: "absent",
        nodeName: "BM25",
        role: MATCH_ROLE,
        rank: null,
        score: null,
        delta: null,
        effect: "absent",
      },
    ]);

    expect([...focus.traveledNodeIds]).toEqual(["a", "b"]);
    expect([...focus.absentNodeIds]).toEqual(["absent"]);
    expect([...focus.traveledEdgeIds]).toEqual(["write", "read"]);
    expect([...focus.absentEdgeIds]).toEqual(["miss"]);
    expect([...focus.storeNodeIds]).toEqual(["store"]);
  });
});
