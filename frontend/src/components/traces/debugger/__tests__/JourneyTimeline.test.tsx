import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { JourneyTimeline } from "@/components/traces/debugger/JourneyTimeline";
import { UNRECORDED_SECTION_MESSAGE } from "@/components/traces/lib/journey-sentences";

import type { JourneySection, JourneyStep } from "@/components/traces/lib/journey";

const step = (overrides: Partial<JourneyStep>): JourneyStep => ({
  nodeId: "node",
  nodeName: "Node",
  stage: "retrieval",
  stageLabel: "Retrieval",
  role: "matches",
  rank: null,
  score: null,
  delta: null,
  effect: "passed",
  inputRank: null,
  inputCount: null,
  outputCount: null,
  inputListCount: 0,
  ...overrides,
});

const renderTimeline = (sections: JourneySection[], activeNodeId: string | null = null) => {
  const onSelectNode = vi.fn();
  const onStepBack = vi.fn();
  const onStepForward = vi.fn();
  render(
    <JourneyTimeline
      sections={sections}
      traceStepsByNodeId={new Map()}
      activeNodeId={activeNodeId}
      focusedItemId="doc:1"
      onSelectNode={onSelectNode}
      onFocusItem={vi.fn()}
      onStepBack={onStepBack}
      onStepForward={onStepForward}
    />,
  );
  return { onSelectNode, onStepBack, onStepForward };
};

describe("JourneyTimeline", () => {
  it("tells the hybrid story in retrieval vocabulary, one card per node", () => {
    renderTimeline([
      {
        stage: "origin",
        stageLabel: "Ingestion · origin",
        recorded: true,
        steps: [
          step({
            nodeId: "chunker",
            nodeName: "Token Chunker",
            role: "chunks",
            effect: "created",
            rank: 5,
            outputCount: 74,
          }),
        ],
      },
      {
        stage: "retrieval",
        stageLabel: "Retrieval",
        recorded: true,
        steps: [
          step({
            nodeId: "dense",
            nodeName: "Semantic Retriever",
            effect: "introduced",
            rank: 3,
            outputCount: 5,
            score: 0.74,
          }),
          step({ nodeId: "bm25", nodeName: "BM25 Retriever", effect: "absent", outputCount: 5 }),
        ],
      },
    ]);

    expect(screen.getByText("Created as chunk 5 of 74")).toBeInTheDocument();
    expect(screen.getByText("Matched at rank 3 of 5 · score 0.740")).toBeInTheDocument();
    expect(screen.getByText("Not in this node's top 5")).toBeInTheDocument();
    expect(screen.getByText("Ingestion · origin")).toBeInTheDocument();
    expect(screen.getByText("Retrieval")).toBeInTheDocument();
  });

  it("labels a stage without item identity as unrecorded instead of a column of misses", () => {
    renderTimeline([
      {
        stage: "origin",
        stageLabel: "Ingestion",
        recorded: true,
        steps: [
          step({ nodeId: "chunker", nodeName: "Chunker", role: "chunks", effect: "created" }),
        ],
      },
      { stage: "retrieval", stageLabel: "Retrieval", recorded: false, steps: [] },
    ]);

    expect(screen.getByText(UNRECORDED_SECTION_MESSAGE)).toBeInTheDocument();
    expect(screen.queryByText(/Not in this node's/)).not.toBeInTheDocument();
  });

  it("steps the walkthrough and selects nodes from cards", () => {
    const { onSelectNode, onStepBack, onStepForward } = renderTimeline(
      [
        {
          stage: "retrieval",
          stageLabel: "Retrieval",
          recorded: true,
          steps: [
            step({ nodeId: "dense", nodeName: "Semantic Retriever", effect: "introduced" }),
            step({ nodeId: "fusion", nodeName: "RRF Fusion", effect: "merged", inputListCount: 2 }),
          ],
        },
      ],
      "dense",
    );

    expect(screen.getByText("1 / 2")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next journey step" }));
    expect(onStepForward).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Previous journey step" }));
    expect(onStepBack).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Journey step RRF Fusion" }));
    expect(onSelectNode).toHaveBeenCalledWith("fusion");
  });
});
