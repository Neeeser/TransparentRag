import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useCollectionSearch } from "@/components/collections/detail/search/use-collection-search";
import * as apiModule from "@/lib/api";
import { makeQueryResult } from "@/test/fixtures";

vi.mock("@/lib/api", async () => (await import("@/test/mocks")).mockApi());

const api = vi.mocked(apiModule);

describe("useCollectionSearch", () => {
  beforeEach(() => {
    api.runCollectionQuery.mockReset();
  });

  it("restores the last result set when the page remounts in the same tab", async () => {
    // Navigating from search results into a trace and back remounts the page;
    // the results being inspected must survive the round trip.
    const response = makeQueryResult({ query_event_id: "event-9" });
    api.runCollectionQuery.mockResolvedValueOnce(response);

    const first = renderHook(() => useCollectionSearch("token", "col-1"));
    act(() => first.result.current.setQuery("why fusion helps"));
    await act(async () => first.result.current.run());
    expect(first.result.current.result).toEqual(response);
    first.unmount();

    const second = renderHook(() => useCollectionSearch("token", "col-1"));
    await act(async () => Promise.resolve());
    expect(second.result.current.result).toEqual(response);
    expect(second.result.current.query).toBe("why fusion helps");
    expect(api.runCollectionQuery).toHaveBeenCalledTimes(1);
  });

  it("keeps collections' stored results separate", async () => {
    const response = makeQueryResult();
    api.runCollectionQuery.mockResolvedValueOnce(response);

    const first = renderHook(() => useCollectionSearch("token", "col-1"));
    act(() => first.result.current.setQuery("query"));
    await act(async () => first.result.current.run());
    first.unmount();

    const other = renderHook(() => useCollectionSearch("token", "col-2"));
    await act(async () => Promise.resolve());
    expect(other.result.current.result).toBeNull();
  });
});
