"use client";

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CollectionSearch } from "@/components/collections/detail/CollectionSearch";
import * as apiModule from "@/lib/api";
import { makeQueryResult } from "@/test/fixtures";
import { getMockRouter } from "@/test/test-utils";

vi.mock("@/lib/api", async () => (await import("@/test/mocks")).mockApi());

const api = vi.mocked(apiModule);

const runQueryLabel = "Run query";
const viewTraceLabel = "View retrieval trace";
const queryFailedMessage = "Query failed.";
const ZERO_WIDTH_BAR_SELECTOR = 'div[style*="width: 0%"]';

describe("CollectionSearch", () => {
  it("skips empty queries", async () => {
    render(<CollectionSearch collectionId="col-1" token="token" />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "   " } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: runQueryLabel }));
    });
    expect(api.runCollectionQuery).not.toHaveBeenCalled();
  });

  it("runs queries and navigates to the trace debugger", async () => {
    const result = makeQueryResult({
      query: "test query",
      top_k: 3,
      query_event_id: "event-1",
      chunks: [
        {
          id: "chunk-1",
          chunk_id: "chunk-1",
          chunk_index: 0,
          score: 0.7,
          text: "Chunk text",
          metadata: { source: "doc" },
        },
        { id: "chunk-2", chunk_id: "chunk-2", chunk_index: 1, score: 0, text: "Empty score" },
        { id: "chunk-3", chunk_index: 2, score: 0.4, text: "Fallback id" },
      ],
    });
    api.runCollectionQuery.mockResolvedValueOnce(result);

    render(<CollectionSearch collectionId="col-1" token="token" />);

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Find" } });
    fireEvent.change(screen.getByLabelText("Top K"), { target: { value: "3" } });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: runQueryLabel }));
    });

    await waitFor(() => {
      expect(screen.getByText("Chunk text")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(viewTraceLabel));
    expect(getMockRouter().push).toHaveBeenCalledWith("/traces/queries/event-1");

    // Tracing a specific chunk targets it so the debugger joins retrieval
    // with the chunk's ingestion origin.
    fireEvent.click(screen.getAllByRole("button", { name: "Trace result" })[0]);
    expect(getMockRouter().push).toHaveBeenCalledWith("/traces/queries/event-1?chunk=chunk-1");

    // Chunks without a chunk_id fall back to their row id.
    fireEvent.click(screen.getAllByRole("button", { name: "Trace result" })[2]);
    expect(getMockRouter().push).toHaveBeenCalledWith("/traces/queries/event-1?chunk=chunk-3");
  });

  it("handles query errors and traces without a query event", async () => {
    api.runCollectionQuery.mockRejectedValueOnce(new Error(queryFailedMessage));
    render(<CollectionSearch collectionId="col-1" token="token" />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: runQueryLabel }));
    });
    expect(screen.getByText(queryFailedMessage)).toBeInTheDocument();

    api.runCollectionQuery.mockResolvedValueOnce(
      makeQueryResult({ query_event_id: undefined, chunks: [] }),
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: runQueryLabel }));
    });
    fireEvent.click(screen.getByText(viewTraceLabel));
    expect(screen.getByText("Trace is not available for this query.")).toBeInTheDocument();
    expect(getMockRouter().push).not.toHaveBeenCalled();
  });

  it("falls back for missing scores and text", async () => {
    api.runCollectionQuery.mockResolvedValueOnce(
      makeQueryResult({
        query_event_id: "event-4",
        chunks: [
          { id: "chunk-5", chunk_index: 0, score: 0.5, text: "Alpha" },
          { id: "chunk-6", chunk_index: 1, score: undefined, text: undefined },
        ],
      }),
    );

    const { container } = render(<CollectionSearch collectionId="col-1" token="token" />);

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Find" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: runQueryLabel }));
    });

    await waitFor(() => {
      expect(screen.getByText("Alpha")).toBeInTheDocument();
    });

    // Score bar width is a styled <div> with no accessible handle; assert the
    // zero-score chunk renders a 0% bar.
    expect(container.querySelector(ZERO_WIDTH_BAR_SELECTOR)).toBeInTheDocument();
  });

  it("uses fallback errors for non-error query failures", async () => {
    api.runCollectionQuery.mockRejectedValueOnce("nope");
    render(<CollectionSearch collectionId="col-1" token="token" />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: runQueryLabel }));
    });

    expect(screen.getByText(queryFailedMessage)).toBeInTheDocument();
  });
});
