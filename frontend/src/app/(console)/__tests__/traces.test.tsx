import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import TraceDocumentPage from "@/app/(console)/traces/documents/[documentId]/page";
import TraceQueryPage from "@/app/(console)/traces/queries/[queryEventId]/page";
import TraceRunPage from "@/app/(console)/traces/runs/[runId]/page";
import { setMockParams, setMockSearchParams } from "@/test/test-utils";

import type { TraceSource } from "@/components/traces/debugger/hooks/use-trace-debugger";

const DEBUGGER_TESTID = "trace-debugger";

vi.mock("@/components/traces/debugger/TraceDebugger", () => ({
  TraceDebugger: ({ source }: { source: TraceSource }) => (
    <div data-testid={DEBUGGER_TESTID}>{JSON.stringify(source)}</div>
  ),
}));

describe("trace pages", () => {
  it("opens the debugger on the routed query event and chunk", () => {
    setMockParams({ queryEventId: "qe-9" });
    setMockSearchParams("chunk=chunk-3");

    render(<TraceQueryPage />);

    expect(screen.getByTestId(DEBUGGER_TESTID)).toHaveTextContent(
      JSON.stringify({ kind: "query", id: "qe-9", chunkId: "chunk-3" }),
    );
  });

  it("opens the debugger on the routed document", () => {
    setMockParams({ documentId: "doc-9" });

    render(<TraceDocumentPage />);

    expect(screen.getByTestId(DEBUGGER_TESTID)).toHaveTextContent(
      JSON.stringify({ kind: "document", id: "doc-9", chunkId: null }),
    );
  });

  it("opens the debugger on the routed pipeline run", () => {
    setMockParams({ runId: "run-9" });

    render(<TraceRunPage />);

    expect(screen.getByTestId(DEBUGGER_TESTID)).toHaveTextContent(
      JSON.stringify({ kind: "run", id: "run-9", chunkId: null }),
    );
  });
});
