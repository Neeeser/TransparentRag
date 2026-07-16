import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { NodeEvidencePanel } from "@/components/traces/debugger/NodeEvidencePanel";
import { makeNodeRunTrace } from "@/test/fixtures";

import type { PipelineNodeData } from "@/components/pipelines/PipelineNode";
import type { TraceStep } from "@/components/traces/trace-graph";
import type { Node } from "@xyflow/react";

const SOURCE_PATH = "/docs/guide.md";
const PARSED_DOCUMENT = "Parsed markdown";

const step: TraceStep = {
  nodeId: "parser",
  nodeIds: ["parser"],
  run: makeNodeRunTrace({
    node_id: "parser",
    node_name: "Markdown parser",
    summary: {
      inputs: [{ label: "Source", kind: "text", value: SOURCE_PATH }],
      outputs: [{ label: "Document", kind: "text", value: PARSED_DOCUMENT }],
    },
  }),
  io: {
    inputs: [
      {
        id: "io-input",
        run_id: "run",
        node_run_id: "node-run",
        node_id: "parser",
        io_type: "input",
        port: "document",
        payload: { raw_only: "raw parser payload" },
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      },
    ],
    outputs: [],
  },
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
    expect(screen.getByRole("navigation", { name: "Node data fields" })).toBeInTheDocument();
    expect(screen.getByText(PARSED_DOCUMENT)).toBeInTheDocument();
    expect(screen.queryByText(SOURCE_PATH)).not.toBeInTheDocument();
    expect(screen.queryByText(/raw parser payload/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Input Source" }));
    expect(screen.getByText(SOURCE_PATH)).toBeInTheDocument();
    expect(screen.queryByText(PARSED_DOCUMENT)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Configuration" }));
    expect(screen.getByText(/markdown/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Raw payload" }));
    expect(
      within(screen.getByRole("tabpanel")).getByText(/"node_id": "parser"/),
    ).toBeInTheDocument();
  });
});
