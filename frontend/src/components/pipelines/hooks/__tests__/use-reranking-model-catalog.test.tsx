import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useRerankingModelCatalog } from "@/components/pipelines/hooks/use-reranking-model-catalog";
import * as apiModule from "@/lib/api";
import { makeCatalogModel, makeModelCatalog } from "@/test/fixtures";

vi.mock("@/lib/api", async () => (await import("@/test/mocks")).mockApi());

const api = vi.mocked(apiModule);

describe("useRerankingModelCatalog", () => {
  beforeEach(() => {
    api.fetchRerankingModels.mockReset();
  });

  it("loads reranking models and reports per-connection catalog errors", async () => {
    const model = makeCatalogModel({ id: "reranker-1" });
    api.fetchRerankingModels.mockResolvedValue(
      makeModelCatalog(
        [model],
        [{ connection_id: "broken", connection_label: "Broken provider", message: "Timed out" }],
      ),
    );

    const { result } = renderHook(() => useRerankingModelCatalog("token", "reranking-user"));

    await waitFor(() => expect(result.current.rerankingModels).toEqual([model]));
    expect(result.current.rerankingModelsError).toBe("Broken provider: Timed out");

    await act(async () => result.current.refreshModels());
    expect(api.fetchRerankingModels).toHaveBeenCalledTimes(2);
  });
});
