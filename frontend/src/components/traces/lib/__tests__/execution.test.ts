import { describe, expect, it } from "vitest";

import { buildExecutionSections, initialExecutionNodeId } from "@/components/traces/lib/execution";
import { makeNodeRunTrace } from "@/test/fixtures";

import type { TraceGraph, TraceStage, TraceStep } from "@/components/traces/trace-graph";
import type { PipelineNodeSummaryValue } from "@/lib/types";

const FOCUSED_ID = "doc:2";
const ORIGIN_STAGE: TraceStage = "origin";
const RETRIEVAL_STAGE: TraceStage = "retrieval";
const RETRIEVAL_INPUT_ID = "retrieval::input";
const ORIGIN_INPUT_ID = "origin::input";
const RETRIEVAL_DENSE_ID = "retrieval::dense";

const itemList = (ids: string[]): PipelineNodeSummaryValue => ({
  label: "Match items",
  kind: "items",
  value: {
    kind: "matches",
    items: ids.map((id, index) => ({ id, score: 1 - index / 10 })),
  },
});

const step = (
  nodeId: string,
  nodeName: string,
  stage: TraceStage,
  outputs: PipelineNodeSummaryValue[] = [],
  status: "completed" | "failed" = "completed",
): TraceStep => ({
  nodeIds: [nodeId],
  nodeId,
  run: makeNodeRunTrace({
    node_id: nodeId,
    node_name: nodeName,
    status,
    summary: { inputs: [], outputs },
  }),
  io: { inputs: [], outputs: [] },
  stage,
  stageLabel: stage === ORIGIN_STAGE ? "Ingestion" : "Retrieval",
});

const graph = (steps: TraceStep[]): TraceGraph => ({
  nodes: [],
  edges: [],
  steps,
  combined: steps.some((entry) => entry.stage === ORIGIN_STAGE),
});

describe("buildExecutionSections", () => {
  it("keeps every executed node and annotates item-capable rows", () => {
    const trace = graph([
      step(ORIGIN_INPUT_ID, "Ingestion input", ORIGIN_STAGE),
      step("origin::parser", "Markdown parser", ORIGIN_STAGE),
      step("origin::chunk", "Token chunker", ORIGIN_STAGE, [itemList([FOCUSED_ID])]),
      step(RETRIEVAL_INPUT_ID, "Retrieval input", RETRIEVAL_STAGE),
      step(RETRIEVAL_DENSE_ID, "Semantic retriever", RETRIEVAL_STAGE, [
        itemList(["other", FOCUSED_ID]),
      ]),
    ]);

    const sections = buildExecutionSections(trace, FOCUSED_ID);

    expect(sections.map((section) => section.label)).toEqual(["Ingestion", "Retrieval"]);
    expect(sections.flatMap((section) => section.entries).map((entry) => entry.nodeId)).toEqual([
      ORIGIN_INPUT_ID,
      "origin::parser",
      "origin::chunk",
      "retrieval::input",
      RETRIEVAL_DENSE_ID,
    ]);
    expect(sections[0].entries[0].itemEffect).toBeNull();
    expect(sections[0].entries[2].itemEffect).toMatchObject({ effect: "introduced", rank: 1 });
    expect(sections[1].entries[1].itemEffect).toMatchObject({ effect: "introduced", rank: 2 });
  });
});

describe("initialExecutionNodeId", () => {
  it("starts a focused end-to-end trace at retrieval input", () => {
    const trace = graph([
      step(ORIGIN_INPUT_ID, "Ingestion input", ORIGIN_STAGE),
      step(RETRIEVAL_INPUT_ID, "Retrieval input", RETRIEVAL_STAGE),
      step(RETRIEVAL_DENSE_ID, "Semantic retriever", RETRIEVAL_STAGE),
    ]);

    expect(initialExecutionNodeId(trace, true)).toBe(RETRIEVAL_INPUT_ID);
  });

  it("prioritizes the first failed node", () => {
    const trace = graph([
      step("input", "Input", RETRIEVAL_STAGE),
      step("embed", "Embed", RETRIEVAL_STAGE, [], "failed"),
      step("output", "Output", RETRIEVAL_STAGE),
    ]);

    expect(initialExecutionNodeId(trace, true)).toBe("embed");
  });
});
