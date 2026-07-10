import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TraceDebugger } from "@/components/traces/debugger/TraceDebugger";
import * as apiModule from "@/lib/api";
import { makeNodeRunTrace, makeTraceResponse } from "@/test/fixtures";

import type { PipelineTraceResponse } from "@/lib/types";

const routerBack = vi.fn();

vi.mock("@/lib/api", async () => (await import("@/test/mocks")).mockApi());
vi.mock("@/providers/auth-provider", async () =>
  (await import("@/test/mocks")).mockAuth({ token: "test-token" }),
);
vi.mock("next/navigation", () => ({
  useRouter: () => ({ back: routerBack, push: vi.fn(), replace: vi.fn() }),
}));

let lastReactFlowProps: Record<string, unknown> | null = null;
vi.mock("@xyflow/react", () => ({
  ReactFlow: (props: Record<string, unknown>) => {
    lastReactFlowProps = props;
    return <div data-testid="reactflow" />;
  },
  Background: () => <div data-testid="background" />,
  Handle: () => <div />,
  Position: { Top: "top", Bottom: "bottom", Left: "left", Right: "right" },
  BaseEdge: () => <div />,
  getBezierPath: () => ["M0 0"],
}));

const api = vi.mocked(apiModule);

function makeTwoNodeTrace(overrides: Partial<PipelineTraceResponse> = {}): PipelineTraceResponse {
  const base = makeTraceResponse();
  return {
    ...base,
    definition: {
      nodes: [
        { id: "n1", type: "parser.text", name: "Parse", config: {}, position: { x: 0, y: 0 } },
        {
          id: "n2",
          type: "chunker.token",
          name: "Chunk",
          config: {},
          position: { x: 100, y: 0 },
        },
      ],
      edges: [{ id: "e1", source: "n1", target: "n2", source_port: "out", target_port: "in" }],
      viewport: {},
    },
    node_runs: [
      makeNodeRunTrace({
        id: "nr1",
        node_id: "n1",
        node_type: "parser.text",
        node_name: "Parse",
        sequence_index: 0,
        summary: {
          inputs: [{ label: "Source", value: "file.pdf", kind: "text" }],
          outputs: [],
        },
      }),
      makeNodeRunTrace({
        id: "nr2",
        node_id: "n2",
        node_type: "chunker.token",
        node_name: "Chunk",
        sequence_index: 1,
        summary: {
          inputs: [],
          outputs: [{ label: "Chunks", value: "42 chunks", kind: "text" }],
        },
      }),
    ],
    ...overrides,
  };
}

describe("TraceDebugger", () => {
  beforeEach(() => {
    lastReactFlowProps = null;
  });

  it("shows the error state with a way back when the trace cannot load", async () => {
    api.fetchDocumentTrace.mockRejectedValueOnce(new Error("Trace not found."));

    render(<TraceDebugger source={{ kind: "document", id: "doc-x", chunkId: null }} />);

    await waitFor(() => expect(screen.getByText("Trace not found.")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /back/i }));
    expect(routerBack).toHaveBeenCalled();
  });

  it("renders the rail, graph, and inspector once the trace loads", async () => {
    api.fetchPipelineRunTrace.mockResolvedValueOnce(makeTwoNodeTrace());

    render(<TraceDebugger source={{ kind: "run", id: "run-1", chunkId: null }} />);

    await waitFor(() => expect(screen.getByTestId("reactflow")).toBeInTheDocument());
    expect(screen.getByRole("navigation", { name: "Trace steps" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Node inspector" })).toBeInTheDocument();
    // Starts on the first step: its summary values render in the inspector.
    expect(screen.getByText("file.pdf")).toBeInTheDocument();
  });

  it("keeps the inspector in lockstep with a rail jump", async () => {
    api.fetchPipelineRunTrace.mockResolvedValueOnce(makeTwoNodeTrace());

    render(<TraceDebugger source={{ kind: "run", id: "run-1", chunkId: null }} />);
    await waitFor(() => expect(screen.getByTestId("reactflow")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /Chunk/ }));
    expect(screen.getByText("42 chunks")).toBeInTheDocument();
    expect(screen.queryByText("file.pdf")).not.toBeInTheDocument();
  });

  it("keeps the inspector in lockstep with a graph node click", async () => {
    api.fetchPipelineRunTrace.mockResolvedValueOnce(makeTwoNodeTrace());

    render(<TraceDebugger source={{ kind: "run", id: "run-1", chunkId: null }} />);
    await waitFor(() => expect(lastReactFlowProps).not.toBeNull());

    act(() => {
      (lastReactFlowProps?.onNodeClick as (event: unknown, node: { id: string }) => void)(null, {
        id: "n2",
      });
    });
    expect(screen.getByText("42 chunks")).toBeInTheDocument();
  });

  it("opens a failed run on its first failed node", async () => {
    const trace = makeTwoNodeTrace();
    trace.run = { ...trace.run, status: "failed" };
    trace.node_runs = [
      trace.node_runs[0],
      { ...trace.node_runs[1], status: "failed", error_message: "Embedding blew up" },
    ];
    api.fetchPipelineRunTrace.mockResolvedValueOnce(trace);

    render(<TraceDebugger source={{ kind: "run", id: "run-1", chunkId: null }} />);

    await waitFor(() => expect(screen.getByText("Embedding blew up")).toBeInTheDocument());
    expect(screen.getByText("42 chunks")).toBeInTheDocument();
  });

  it("shows the traced chunk badge when a chunk is targeted", async () => {
    api.fetchQueryEventEndToEndTrace.mockResolvedValueOnce({
      retrieval: makeTwoNodeTrace(),
      origin: null,
    });

    render(<TraceDebugger source={{ kind: "query", id: "qe-1", chunkId: "chunk-7" }} />);

    await waitFor(() => expect(screen.getByText(/chunk-7/)).toBeInTheDocument());
  });

  it("offers a refresh for a still-running trace and refetches on click", async () => {
    const running = makeTwoNodeTrace();
    running.run = { ...running.run, status: "running", completed_at: null };
    api.fetchPipelineRunTrace.mockResolvedValue(running);

    render(<TraceDebugger source={{ kind: "run", id: "run-1", chunkId: null }} />);
    await waitFor(() => expect(screen.getByTestId("reactflow")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /refresh/i }));
    await waitFor(() => expect(api.fetchPipelineRunTrace).toHaveBeenCalledTimes(2));
  });

  it("surfaces the node-spec notice without blocking the trace", async () => {
    api.fetchPipelineNodes.mockRejectedValueOnce(new Error("boom"));
    api.fetchPipelineRunTrace.mockResolvedValueOnce(makeTwoNodeTrace());

    render(<TraceDebugger source={{ kind: "run", id: "run-1", chunkId: null }} />);

    await waitFor(() =>
      expect(screen.getByText(/Node details are unavailable/)).toBeInTheDocument(),
    );
    expect(screen.getByTestId("reactflow")).toBeInTheDocument();
  });
});
