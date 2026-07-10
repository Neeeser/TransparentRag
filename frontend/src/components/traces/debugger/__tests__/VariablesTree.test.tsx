import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { VariablesTree } from "@/components/traces/debugger/VariablesTree";

import type { PipelineNodeIOTrace } from "@/lib/types";

const TIMESTAMP = "2024-01-01T00:00:00.000Z";
const INPUTS_TITLE = "Inputs";
const NO_INPUTS_LABEL = "No primary inputs recorded.";
const HELLO_VALUE = "hello world";
const ARIA_EXPANDED = "aria-expanded";

function makeIO(overrides: Partial<PipelineNodeIOTrace> = {}): PipelineNodeIOTrace {
  return {
    id: "io-1",
    run_id: "run-1",
    node_run_id: "nr-1",
    node_id: "node-1",
    io_type: "input",
    port: "documents",
    payload: { value: "raw-payload-value" },
    created_at: TIMESTAMP,
    updated_at: TIMESTAMP,
    ...overrides,
  };
}

describe("VariablesTree", () => {
  it("shows summary values expanded by default and collapses on toggle", () => {
    render(
      <VariablesTree
        title={INPUTS_TITLE}
        tone="cyan"
        summaryItems={[{ label: "Query", value: HELLO_VALUE, kind: "text" }]}
        ioRecords={[]}
        emptySummaryLabel={NO_INPUTS_LABEL}
      />,
    );

    expect(screen.getByText(HELLO_VALUE)).toBeInTheDocument();

    const toggle = screen.getByRole("button", { name: /Query/ });
    expect(toggle).toHaveAttribute(ARIA_EXPANDED, "true");
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute(ARIA_EXPANDED, "false");
    expect(screen.queryByText(HELLO_VALUE)).not.toBeInTheDocument();
  });

  it("keeps raw payloads collapsed until their port row is expanded", () => {
    render(
      <VariablesTree
        title={INPUTS_TITLE}
        tone="cyan"
        summaryItems={[]}
        ioRecords={[makeIO()]}
        emptySummaryLabel={NO_INPUTS_LABEL}
      />,
    );

    expect(screen.queryByText(/raw-payload-value/)).not.toBeInTheDocument();

    const row = screen.getByRole("button", { name: /documents/ });
    expect(row).toHaveAttribute(ARIA_EXPANDED, "false");
    fireEvent.click(row);
    expect(row).toHaveAttribute(ARIA_EXPANDED, "true");
    expect(screen.getByText(/raw-payload-value/)).toBeInTheDocument();
  });

  it("shows the empty labels when nothing was recorded", () => {
    render(
      <VariablesTree
        title="Outputs"
        tone="violet"
        summaryItems={[]}
        ioRecords={[]}
        emptySummaryLabel="No primary outputs recorded."
      />,
    );

    expect(screen.getByText("No primary outputs recorded.")).toBeInTheDocument();
  });

  it("highlights entries containing the traced chunk", () => {
    render(
      <VariablesTree
        title={INPUTS_TITLE}
        tone="cyan"
        summaryItems={[{ label: "Chunk", value: { chunk_id: "chunk-1" }, kind: "json" }]}
        ioRecords={[]}
        highlightChunkId="chunk-1"
        emptySummaryLabel={NO_INPUTS_LABEL}
      />,
    );

    expect(screen.getByTestId("variable-row-Chunk")).toHaveAttribute("data-highlighted", "true");
  });
});
