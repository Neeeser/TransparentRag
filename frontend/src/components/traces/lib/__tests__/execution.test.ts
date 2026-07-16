import { describe, expect, it } from "vitest";

import { buildExecutionSections, initialExecutionNodeId } from "@/components/traces/lib/execution";
import { makeNodeRunTrace } from "@/test/fixtures";

import type { TraceGraph, TraceStage, TraceStep } from "@/components/traces/trace-graph";
import type { PipelineNodeSummaryValue } from "@/lib/types";

const FOCUSED_ID = "doc:2";

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
  stageLabel: stage === "origin" ? "Ingestion" : "Retrieval",
});

const graph = (steps: TraceStep[]): TraceGraph => ({
  nodes: [],
  edges: [],
  steps,
  combined: steps.some((entry) => entry.stage === "origin"),
});

describe("buildExecutionSections", () => {
  it("keeps every executed node and annotates item-capable rows", () => {
    const trace = graph([
      step("origin::input", "Ingestion input", "origin"),
      step("origin::parser", "Markdown parser", "origin"),
      step("origin::chunk", "Token chunker", "origin", [itemList([FOCUSED_ID])]),
      step("retrieval::input", "Retrieval input", "retrieval"),
      step("retrieval::dense", "Semantic retriever", "retrieval", [
        itemList(["other", FOCUSED_ID]),
      ]),
    ]);

    const sections = buildExecutionSections(trace, FOCUSED_ID);

    expect(sections.map((section) => section.label)).toEqual(["Ingestion", "Retrieval"]);
    expect(sections.flatMap((section) => section.entries).map((entry) => entry.nodeId)).toEqual([
      "origin::input",
      "origin::parser",
      "origin::chunk",
      "retrieval::input",
      "retrieval::dense",
    ]);
    expect(sections[0].entries[0].itemEffect).toBeNull();
    expect(sections[0].entries[2].itemEffect).toMatchObject({ effect: "introduced", rank: 1 });
    expect(sections[1].entries[1].itemEffect).toMatchObject({ effect: "introduced", rank: 2 });
  });
});

describe("initialExecutionNodeId", () => {
  it("starts a focused end-to-end trace at retrieval input", () => {
    const trace = graph([
      step("origin::input", "Ingestion input", "origin"),
      step("retrieval::input", "Retrieval input", "retrieval"),
      step("retrieval::dense", "Semantic retriever", "retrieval"),
    ]);

    expect(initialExecutionNodeId(trace, true)).toBe("retrieval::input");
  });

  it("prioritizes the first failed node", () => {
    const trace = graph([
      step("input", "Input", "retrieval"),
      step("embed", "Embed", "retrieval", [], "failed"),
      step("output", "Output", "retrieval"),
    ]);

    expect(initialExecutionNodeId(trace, true)).toBe("embed");
  });
});
