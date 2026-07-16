import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { NodeExplanation } from "@/components/traces/explanations/NodeExplanation";
import { makeNodeRunTrace } from "@/test/fixtures";

import type { PipelineNodeData } from "@/components/pipelines/PipelineNode";
import type { TraceStep } from "@/components/traces/trace-graph";
import type { PipelineNodeSummary, TraceFocusedItem } from "@/lib/types";
import type { Node } from "@xyflow/react";

const makeStep = (nodeType: string, summary: PipelineNodeSummary): TraceStep => ({
  nodeId: "node",
  nodeIds: ["node"],
  run: makeNodeRunTrace({ node_id: "node", node_type: nodeType, summary }),
  io: { inputs: [], outputs: [] },
  stage: nodeType.startsWith("retriev") || nodeType.startsWith("fusion") ? "retrieval" : "origin",
  stageLabel: "Stage",
});

const makeNode = (
  nodeType: string,
  config: Record<string, unknown> = {},
): Node<PipelineNodeData> => ({
  id: "node",
  type: "pipelineNode",
  position: { x: 0, y: 0 },
  data: { label: "Node", nodeType, description: "Description", inputs: [], outputs: [], config },
});

const contextItem = (index: number, text: string): TraceFocusedItem => ({
  id: `doc:${index}`,
  status: "resolved",
  text,
  document_id: "doc",
  filename: "guide.md",
  chunk_index: index,
  chunk_count: 5,
});

describe("NodeExplanation", () => {
  it("shows parser source path flowing into normalized text", () => {
    const summary: PipelineNodeSummary = {
      inputs: [
        {
          label: "Source",
          kind: "json",
          value: { document_id: "doc", path: "/uploads/guide.md", content_type: "text/markdown" },
        },
      ],
      outputs: [
        {
          label: "Text",
          kind: "text",
          value: {
            preview: "# Guide\nParsed content",
            length: 22,
            full: "# Guide\nParsed content",
          },
        },
      ],
    };

    render(
      <NodeExplanation
        step={makeStep("parser.document", summary)}
        node={makeNode("parser.document")}
        focusedItemId={null}
        contextItems={[]}
        itemEffect={null}
        inputSources={[]}
      />,
    );

    expect(screen.getByText("/uploads/guide.md")).toBeInTheDocument();
    expect(screen.getByText("text/markdown")).toBeInTheDocument();
    expect(screen.getByText("# Guide Parsed content")).toBeInTheDocument();
  });

  it("renders a focused chunk between its real neighbors", () => {
    const summary: PipelineNodeSummary = {
      inputs: [],
      outputs: [
        {
          label: "Chunk items",
          kind: "items",
          value: {
            kind: "chunks",
            items: [0, 1, 2, 3, 4].map((index) => ({ id: `doc:${index}`, score: null })),
          },
        },
      ],
    };

    render(
      <NodeExplanation
        step={makeStep("chunker.token", summary)}
        node={makeNode("chunker.token", { chunk_size: 128, chunk_overlap: 16 })}
        focusedItemId="doc:2"
        contextItems={[
          contextItem(0, "Zero"),
          contextItem(1, "One"),
          contextItem(2, "Two"),
          contextItem(3, "Three"),
          contextItem(4, "Four"),
        ]}
        itemEffect={null}
        inputSources={[]}
      />,
    );

    const neighborhood = screen.getByRole("list", { name: "Chunk neighborhood" });
    expect(
      within(neighborhood)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual([
      expect.stringContaining("Zero"),
      expect.stringContaining("One"),
      expect.stringContaining("Two"),
      expect.stringContaining("Three"),
      expect.stringContaining("Four"),
    ]);
    const focusedRow = within(neighborhood)
      .getByRole("button", { name: "Inspect result doc:2" })
      .closest("li");
    expect(focusedRow).toHaveAttribute("aria-current", "true");
  });

  it("keeps retrieval order stable and only changes trace focus explicitly", () => {
    const ids = ["doc:0", "doc:1", "doc:2", "doc:3"];
    const summary: PipelineNodeSummary = {
      inputs: [],
      outputs: [
        {
          label: "Match items",
          kind: "items",
          value: { kind: "matches", items: ids.map((id, index) => ({ id, score: 20 - index })) },
        },
      ],
    };
    const onFocusItem = vi.fn();

    render(
      <NodeExplanation
        step={makeStep("retriever.bm25", summary)}
        node={makeNode("retriever.bm25")}
        focusedItemId="doc:2"
        contextItems={[contextItem(2, "Chunk 2")]}
        itemEffect={null}
        inputSources={[]}
        onFocusItem={onFocusItem}
      />,
    );

    expect(screen.getByText("BM25 score")).toBeInTheDocument();
    const ranking = screen.getByRole("list", { name: "BM25 ranking" });
    expect(
      within(ranking)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual([
      expect.stringContaining("doc:0"),
      expect.stringContaining("doc:1"),
      expect.stringContaining("doc:2"),
      expect.stringContaining("doc:3"),
    ]);

    fireEvent.click(screen.getByRole("button", { name: "Inspect result doc:1" }));
    expect(onFocusItem).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Trace this result" }));
    expect(onFocusItem).toHaveBeenCalledWith("doc:1");
  });

  it("shows fusion branches beside the fused result order", () => {
    const summary: PipelineNodeSummary = {
      inputs: [
        {
          label: "Branch 1 items",
          kind: "items",
          value: { kind: "matches", items: [{ id: "doc:2", score: 0.7 }] },
        },
        {
          label: "Branch 2 items",
          kind: "items",
          value: { kind: "matches", items: [{ id: "doc:2", score: 12.4 }] },
        },
      ],
      outputs: [
        {
          label: "Fused items",
          kind: "items",
          value: { kind: "matches", items: [{ id: "doc:2", score: 0.032 }] },
        },
      ],
    };

    render(
      <NodeExplanation
        step={makeStep("fusion.rrf", summary)}
        node={makeNode("fusion.rrf", { k: 60 })}
        focusedItemId="doc:2"
        contextItems={[contextItem(2, "Focused text")]}
        itemEffect={null}
        inputSources={["Semantic Retriever", "BM25 Retriever"]}
      />,
    );

    expect(screen.getByText("Semantic Retriever")).toBeInTheDocument();
    expect(screen.getByText("BM25 Retriever")).toBeInTheDocument();
    expect(screen.getByText("Vector similarity")).toBeInTheDocument();
    expect(screen.getByText("BM25 score")).toBeInTheDocument();
    expect(screen.getByText("Fused ranking")).toBeInTheDocument();
    expect(screen.getByText(/1 \/ \(60 \+ rank\)/)).toBeInTheDocument();
  });

  it("preserves the upstream score method at retrieval output", () => {
    const summary: PipelineNodeSummary = {
      inputs: [],
      outputs: [
        {
          label: "Result items",
          kind: "items",
          value: { kind: "matches", items: [{ id: "doc:2", score: 0.032 }] },
        },
      ],
    };

    render(
      <NodeExplanation
        step={makeStep("retrieval.output", summary)}
        node={makeNode("retrieval.output")}
        focusedItemId="doc:2"
        contextItems={[contextItem(2, "Focused text")]}
        itemEffect={null}
        inputSources={["RRF Fusion"]}
      />,
    );

    expect(screen.getByText("RRF score")).toBeInTheDocument();
  });
});
