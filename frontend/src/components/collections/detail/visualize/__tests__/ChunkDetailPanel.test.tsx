import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ChunkDetailPanel } from "@/components/collections/detail/visualize/ChunkDetailPanel";
import { makeChunk, makeChunkDetail, makeDocument } from "@/test/fixtures";

import type { UmapPoint } from "@/lib/types";

describe("ChunkDetailPanel", () => {
  const selectedPoint: UmapPoint = {
    id: "point-1",
    chunk_id: "chunk-1",
    document_id: "doc-1",
    chunk_index: 0,
    x: 1,
    y: 2,
  };

  const detail = makeChunkDetail({
    document: makeDocument({ name: "Doc", chunk_size: 12 }),
    chunk: makeChunk({ chunk_size: 12, metadata: { source: "manual" } }),
  });

  it("shows placeholder states", () => {
    const { rerender, container } = render(
      <ChunkDetailPanel detail={null} loading={false} selectedPoint={null} errorMessage={null} />,
    );
    expect(screen.getByText(/Select a point/)).toBeInTheDocument();

    rerender(
      <ChunkDetailPanel detail={null} loading selectedPoint={selectedPoint} errorMessage={null} />,
    );
    // Loader is a decorative <span> with no accessible role.
    expect(container.querySelector("span")).toBeInTheDocument();

    rerender(
      <ChunkDetailPanel
        detail={null}
        loading={false}
        selectedPoint={selectedPoint}
        errorMessage="Failed"
      />,
    );
    expect(screen.getByText("Failed")).toBeInTheDocument();

    rerender(
      <ChunkDetailPanel
        detail={null}
        loading={false}
        selectedPoint={selectedPoint}
        errorMessage={null}
      />,
    );
    expect(screen.getByText(/No chunk details/)).toBeInTheDocument();
  });

  it("renders chunk details", () => {
    const onExpand = vi.fn();
    render(
      <ChunkDetailPanel
        detail={detail}
        loading={false}
        selectedPoint={selectedPoint}
        errorMessage={null}
        onExpand={onExpand}
      />,
    );

    expect(screen.getByText("Doc")).toBeInTheDocument();
    expect(screen.getByText(/Indexed/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Expand" }));
    expect(onExpand).toHaveBeenCalled();

    expect(screen.getByText("#1")).toBeInTheDocument();
    expect(screen.getByText("token")).toBeInTheDocument();
    expect(screen.getByText(/12 tokens/)).toBeInTheDocument();
    expect(screen.getByText("Chunk text")).toBeInTheDocument();
    expect(screen.getByText(/source/)).toBeInTheDocument();
  });

  it("omits expand button when unavailable", () => {
    render(
      <ChunkDetailPanel
        detail={detail}
        loading={false}
        selectedPoint={selectedPoint}
        errorMessage={null}
      />,
    );

    expect(screen.queryByRole("button", { name: "Expand" })).not.toBeInTheDocument();
  });
});
