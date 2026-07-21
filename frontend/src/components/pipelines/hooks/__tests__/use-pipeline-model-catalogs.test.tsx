import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { usePipelineModelCatalogs } from "@/components/pipelines/hooks/use-pipeline-model-catalogs";
import * as apiModule from "@/lib/api";
import { makeConnection } from "@/test/fixtures";

vi.mock("@/lib/api", async () => (await import("@/test/mocks")).mockApi());

const api = vi.mocked(apiModule);

describe("usePipelineModelCatalogs", () => {
  it("re-reads provider connections when the window regains focus", async () => {
    // Regression: the reranker availability gate read connections once, so a
    // provider added in Settings (another tab) stayed invisible until the
    // ~12-minute token-rotation refetch.
    api.listConnections.mockResolvedValueOnce([]);
    api.listConnections.mockResolvedValue([
      makeConnection({ provider_type: "cohere", kinds: ["reranking"] }),
    ]);

    const { result } = renderHook(() => usePipelineModelCatalogs("token", "focus-user"));

    await waitFor(() => expect(result.current.hasRerankingProvider).toBe(false));
    const callsBeforeFocus = api.listConnections.mock.calls.length;

    await act(async () => {
      window.dispatchEvent(new Event("focus"));
    });

    await waitFor(() => expect(result.current.hasRerankingProvider).toBe(true));
    expect(api.listConnections.mock.calls.length).toBeGreaterThan(callsBeforeFocus);
  });
});
