import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ReadmePipelineCapture } from "@/components/readme/ReadmePipelineCapture";

const flowPlayerSpy = vi.fn();

vi.mock("@/components/pipelines/flow/FlowPlayer", () => ({
  FlowPlayer: (props: object) => {
    flowPlayerSpy(props);
    return <div data-testid="flow-player" />;
  },
}));

describe("ReadmePipelineCapture", () => {
  it("renders the exported default retrieval pipeline through FlowPlayer", () => {
    render(<ReadmePipelineCapture kind="retrieval" />);

    expect(screen.getByRole("heading", { name: "Default retrieval pipeline" })).toBeVisible();
    expect(screen.getByTestId("flow-player")).toBeVisible();
    expect(flowPlayerSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        autoPlay: true,
        loop: true,
        processMs: 550,
        travelMs: 400,
        nodes: expect.arrayContaining([
          expect.objectContaining({ id: "bm25-retriever" }),
          expect.objectContaining({ id: "fuse-results" }),
        ]),
      }),
    );
  });
});
