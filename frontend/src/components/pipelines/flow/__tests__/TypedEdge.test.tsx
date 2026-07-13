import { render, screen } from "@testing-library/react";
import { Position } from "@xyflow/react";
import { describe, expect, it, vi } from "vitest";

import { TypedEdge } from "@/components/pipelines/flow/TypedEdge";

import type { TypedEdgeType } from "@/components/pipelines/flow/TypedEdge";
import type { EdgeProps } from "@xyflow/react";
import type { CSSProperties } from "react";

const SMART_PATH = "M 264 74 L 300 74 L 300 222 L 736 222";
const BATCH_PATH = "M 264 74 L 680 74 L 680 222 L 736 222";
const EDGE_TEST_ID = "base-edge";
const STROKE_ATTRIBUTE = "data-stroke";
const getSmartEdge = vi.fn((input: unknown) => {
  void input;
  return {
    svgPathString: SMART_PATH,
    edgeCenterX: 300,
    edgeCenterY: 120,
    points: [
      [300, 46],
      [300, 194],
    ],
  };
});
type MockRoute = {
  svgPathString: string;
  edgeCenterX: number;
  edgeCenterY: number;
  points: number[][];
};
const useSmartEdgeRoute = vi.fn<(input: unknown) => MockRoute | null>(() => ({
  svgPathString: BATCH_PATH,
  edgeCenterX: 500,
  edgeCenterY: 148,
  points: [
    [680, 74],
    [680, 222],
  ],
}));

vi.mock("@tisoap/react-flow-smart-edge", () => ({
  getSmartEdge: (input: unknown) => getSmartEdge(input),
  useSmartEdgeRoute: (input: unknown) => useSmartEdgeRoute(input),
  smartEdgePresets: {
    smoothstep: {
      drawEdge: vi.fn(),
      generatePath: vi.fn(),
    },
  },
}));

vi.mock("@xyflow/react", () => ({
  BaseEdge: ({ path, style }: { path: string; style?: CSSProperties }) => (
    <path
      data-testid="base-edge"
      d={path}
      data-stroke={style?.stroke}
      data-stroke-width={style?.strokeWidth}
      data-opacity={style?.opacity}
    />
  ),
  getSmoothStepPath: () => ["fallback-path"],
  Position: { Left: "left", Right: "right" },
}));

const edgeProps = {
  id: "source-target",
  source: "source",
  target: "target",
  sourceX: 264,
  sourceY: 74,
  targetX: 736,
  targetY: 222,
  sourcePosition: Position.Right,
  targetPosition: Position.Left,
  data: {
    dataType: "document",
    traveling: true,
    travelMs: 500,
  },
  selected: false,
} satisfies EdgeProps<TypedEdgeType>;

describe("TypedEdge", () => {
  it("uses the shared batch route while preserving state styles and playback", () => {
    const { container } = render(
      <svg>
        <TypedEdge {...edgeProps} />
      </svg>,
    );

    expect(useSmartEdgeRoute).toHaveBeenCalledWith(
      expect.objectContaining({
        id: edgeProps.id,
        source: edgeProps.source,
        target: edgeProps.target,
        sourceX: edgeProps.sourceX,
        sourceY: edgeProps.sourceY,
        targetX: edgeProps.targetX,
        targetY: edgeProps.targetY,
      }),
    );
    expect(getSmartEdge).not.toHaveBeenCalled();
    expect(screen.getByTestId(EDGE_TEST_ID)).toHaveAttribute("d", BATCH_PATH);
    expect(screen.getByTestId(EDGE_TEST_ID)).toHaveAttribute(
      STROKE_ATTRIBUTE,
      "var(--port-document)",
    );
    expect(container.querySelectorAll("animateMotion")).toHaveLength(2);
    container.querySelectorAll("animateMotion").forEach((motion) => {
      expect(motion).toHaveAttribute("path", BATCH_PATH);
      expect(motion).toHaveAttribute("dur", "500ms");
    });
  });

  it("uses the smooth-step fallback while a batch route is pending", () => {
    useSmartEdgeRoute.mockReturnValueOnce(null);

    render(
      <svg>
        <TypedEdge {...edgeProps} data={{ ...edgeProps.data, traveling: false }} />
      </svg>,
    );

    expect(screen.getByTestId(EDGE_TEST_ID)).toHaveAttribute("d", "fallback-path");
  });

  it("preserves validation, emphasis, and visited edge states", () => {
    const { rerender } = render(
      <svg>
        <TypedEdge {...edgeProps} data={{ dataType: "document", error: true }} />
      </svg>,
    );

    expect(screen.getByTestId(EDGE_TEST_ID)).toHaveAttribute(STROKE_ATTRIBUTE, "var(--data-neg)");
    expect(screen.getByTestId(EDGE_TEST_ID)).toHaveAttribute("data-stroke-width", "2.5");
    expect(screen.getByTestId(EDGE_TEST_ID)).toHaveAttribute("data-opacity", "0.95");

    rerender(
      <svg>
        <TypedEdge {...edgeProps} data={{ dataType: "document", visited: true }} />
      </svg>,
    );
    expect(screen.getByTestId(EDGE_TEST_ID)).toHaveAttribute(
      STROKE_ATTRIBUTE,
      "var(--port-document)",
    );
    expect(screen.getByTestId(EDGE_TEST_ID)).toHaveAttribute("data-stroke-width", "1.5");
    expect(screen.getByTestId(EDGE_TEST_ID)).toHaveAttribute("data-opacity", "0.95");
  });
});
