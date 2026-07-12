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
const queryInputLabel = "Search query";
const firstQuery = "first question";

async function runQuery(text = "Find") {
  fireEvent.change(screen.getByLabelText(queryInputLabel), { target: { value: text } });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: runQueryLabel }));
  });
}

describe("CollectionSearch", () => {
  it("disables the run button for empty queries", () => {
    render(<CollectionSearch collectionId="col-1" token="token" />);
    fireEvent.change(screen.getByLabelText(queryInputLabel), { target: { value: "   " } });
    expect(screen.getByRole("button", { name: runQueryLabel })).toBeDisabled();
    expect(api.runCollectionQuery).not.toHaveBeenCalled();
  });

  it("runs queries, expands results, and navigates to traces", async () => {
    api.runCollectionQuery.mockResolvedValueOnce(
      makeQueryResult({
        query_event_id: "event-1",
        chunks: [
          {
            id: "chunk-1",
            chunk_id: "chunk-1",
            chunk_index: 0,
            score: 0.7,
            text: "Chunk text",
            metadata: { document_name: "guide.pdf" },
          },
          { id: "chunk-3", chunk_index: 2, score: 0.4, text: "Fallback id" },
        ],
      }),
    );
    render(<CollectionSearch collectionId="col-1" token="token" />);

    await runQuery();
    await waitFor(() => {
      expect(screen.getByText("Chunk text")).toBeInTheDocument();
    });
    expect(api.runCollectionQuery).toHaveBeenCalledWith("token", "col-1", {
      query: "Find",
      top_k: 5,
    });
    // The source document name comes from chunk metadata.
    expect(screen.getByText("guide.pdf")).toBeInTheDocument();

    // Expand/collapse the full chunk text.
    const expand = screen.getAllByRole("button", { name: /Chunk text/ })[0];
    expect(expand).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(expand);
    expect(expand).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(screen.getByText(viewTraceLabel));
    expect(getMockRouter().push).toHaveBeenCalledWith("/traces/queries/event-1");

    fireEvent.click(screen.getAllByRole("button", { name: "Trace" })[0]);
    expect(getMockRouter().push).toHaveBeenCalledWith("/traces/queries/event-1?chunk=chunk-1");
    // Chunks without a chunk_id fall back to their row id.
    fireEvent.click(screen.getAllByRole("button", { name: "Trace" })[1]);
    expect(getMockRouter().push).toHaveBeenCalledWith("/traces/queries/event-1?chunk=chunk-3");
  });

  it("filters results below the min-score floor client-side", async () => {
    api.runCollectionQuery.mockResolvedValueOnce(
      makeQueryResult({
        query_event_id: "event-2",
        chunks: [
          { id: "c1", chunk_index: 0, score: 1.0, text: "Strong" },
          { id: "c2", chunk_index: 1, score: 0.2, text: "Weak" },
        ],
      }),
    );
    render(<CollectionSearch collectionId="col-1" token="token" />);
    await runQuery();

    await waitFor(() => {
      expect(screen.getByText("Strong")).toBeInTheDocument();
    });
    expect(screen.getByText("Weak")).toBeInTheDocument();

    fireEvent.change(screen.getByRole("slider"), { target: { value: "50" } });
    expect(screen.queryByText("Weak")).not.toBeInTheDocument();
    expect(screen.getByText(/1 of 2 matches/)).toBeInTheDocument();
    expect(screen.getByText(/1 below score floor/)).toBeInTheDocument();
  });

  it("remembers recent queries and re-runs them from chips", async () => {
    api.runCollectionQuery.mockResolvedValue(makeQueryResult({ chunks: [] }));
    render(<CollectionSearch collectionId="col-1" token="token" />);

    await runQuery(firstQuery);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: firstQuery })).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(queryInputLabel), { target: { value: "other" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: firstQuery }));
    });
    expect(api.runCollectionQuery).toHaveBeenLastCalledWith("token", "col-1", {
      query: firstQuery,
      top_k: 5,
    });
  });

  it("surfaces query failures, with a fallback for non-error rejections", async () => {
    api.runCollectionQuery.mockRejectedValueOnce(new Error("Backend exploded"));
    render(<CollectionSearch collectionId="col-1" token="token" />);

    await runQuery();
    expect(screen.getByText("Backend exploded")).toBeInTheDocument();

    api.runCollectionQuery.mockRejectedValueOnce("nope");
    await runQuery("again");
    expect(screen.getByText("Query failed.")).toBeInTheDocument();
  });

  it("omits trace actions when the query has no event id", async () => {
    api.runCollectionQuery.mockResolvedValueOnce(
      makeQueryResult({
        query_event_id: undefined,
        chunks: [{ id: "c1", chunk_index: 0, score: 0.5, text: "Alpha" }],
      }),
    );
    render(<CollectionSearch collectionId="col-1" token="token" />);
    await runQuery();

    await waitFor(() => {
      expect(screen.getByText("Alpha")).toBeInTheDocument();
    });
    expect(screen.queryByText(viewTraceLabel)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Trace" }));
    expect(getMockRouter().push).not.toHaveBeenCalled();
  });
});
