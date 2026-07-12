import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  CollectionProvider,
  useCollection,
} from "@/components/collections/detail/collection-context";
import * as apiModule from "@/lib/api";
import { makeCollection, makeCollectionStats, makePipeline } from "@/test/fixtures";
import { resetMockAuth, setMockAuth } from "@/test/mocks";

vi.mock("@/providers/auth-provider", async () => (await import("@/test/mocks")).mockAuth());
vi.mock("@/lib/api", async () => (await import("@/test/mocks")).mockApi());

const api = vi.mocked(apiModule);

function Probe() {
  const { collection, stats, ingestionPipelines, onCollectionUpdated } = useCollection();
  return (
    <div>
      <p>{collection.name}</p>
      <p>{stats?.document_count} documents</p>
      <p>{ingestionPipelines[0]?.name}</p>
      <button type="button" onClick={() => onCollectionUpdated({ ...collection, name: "Renamed" })}>
        Rename
      </button>
    </div>
  );
}

describe("CollectionProvider", () => {
  const collection = makeCollection({ id: "col-1", name: "Corpus" });
  const stats = makeCollectionStats({ document_count: 7 });
  const pipeline = makePipeline({ kind: "ingestion", name: "Default ingestion" });

  beforeEach(() => {
    resetMockAuth();
    api.fetchCollection.mockResolvedValue(collection);
    api.fetchCollectionStatsById.mockResolvedValue(stats);
    api.fetchPipelines.mockResolvedValue([pipeline]);
  });

  it("provides collection, stats, and pipelines to children once loaded", async () => {
    render(
      <CollectionProvider collectionId="col-1">
        <Probe />
      </CollectionProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("Corpus")).toBeInTheDocument();
    });
    expect(screen.getByText("7 documents")).toBeInTheDocument();
    expect(screen.getByText("Default ingestion")).toBeInTheDocument();
  });

  it("lets children publish collection updates back into the context", async () => {
    render(
      <CollectionProvider collectionId="col-1">
        <Probe />
      </CollectionProvider>,
    );
    await waitFor(() => {
      expect(screen.getByText("Corpus")).toBeInTheDocument();
    });

    screen.getByRole("button", { name: "Rename" }).click();
    await waitFor(() => {
      expect(screen.getByText("Renamed")).toBeInTheDocument();
    });
  });

  it("surfaces load failures instead of rendering children", async () => {
    api.fetchCollection.mockRejectedValueOnce(new Error("Failed"));
    render(
      <CollectionProvider collectionId="col-1">
        <Probe />
      </CollectionProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("Failed")).toBeInTheDocument();
    });
    expect(screen.queryByText("Corpus")).not.toBeInTheDocument();
  });

  it("shows the fallback shell when there is no token", () => {
    setMockAuth({ token: null, user: null });
    const { container } = render(
      <CollectionProvider collectionId="col-1">
        <Probe />
      </CollectionProvider>,
    );
    expect(container.querySelector("span")).toBeInTheDocument();
    expect(screen.queryByText("Corpus")).not.toBeInTheDocument();
  });
});
