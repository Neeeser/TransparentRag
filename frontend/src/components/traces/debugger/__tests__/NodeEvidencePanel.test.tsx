import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { NodeEvidencePanel } from "@/components/traces/debugger/NodeEvidencePanel";
import { makeNodeRunTrace } from "@/test/fixtures";

import type { PipelineNodeData } from "@/components/pipelines/PipelineNode";
import type { TraceStep } from "@/components/traces/trace-graph";
import type { Node } from "@xyflow/react";

const step: TraceStep = {
  nodeId: "parser",
  nodeIds: ["parser"],
  run: makeNodeRunTrace({
    node_id: "parser",
    node_name: "Markdown parser",
    summary: {
      inputs: [{ label: "Source", kind: "text", value: "/docs/guide.md" }],
      outputs: [{ label: "Document", kind: "text", value: "Parsed markdown" }],
    },
  }),
  io: { inputs: [], outputs: [] },
  stage: "origin",
  stageLabel: "Ingestion",
};

const node: Node<PipelineNodeData> = {
  id: "parser",
  type: "pipelineNode",
  position: { x: 0, y: 0 },
  data: {
    label: "Markdown parser",
    nodeType: "parser.markdown",
    description: "Parse Markdown into normalized text.",
    inputs: [],
    outputs: [],
    config: { mode: "markdown" },
  },
};

describe("NodeEvidencePanel", () => {
  it("keeps explanation, data, configuration, and raw payload in one stable pane", () => {
    render(
      <NodeEvidencePanel
        step={step}
        node={node}
        focusedItemId={null}
        contextItems={[]}
        itemEffect={null}
        inputSources={[]}
      />,
    );

    expect(screen.getByRole("region", { name: "Node evidence" })).toBeInTheDocument();
    expect(screen.getByText("Parse Markdown into normalized text.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Node data" }));
    expect(screen.getByText("/docs/guide.md")).toBeInTheDocument();
    expect(screen.getByText("Parsed markdown")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Configuration" }));
    expect(screen.getByText(/markdown/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Raw payload" }));
    expect(
      within(screen.getByRole("tabpanel")).getByText(/"node_id": "parser"/),
    ).toBeInTheDocument();
  });
});
