import { render, screen } from "@testing-library/react";
import { Position } from "@xyflow/react";
import { describe, expect, it, vi } from "vitest";

import { TypedEdge } from "@/components/pipelines/flow/TypedEdge";

import type { TypedEdgeType } from "@/components/pipelines/flow/TypedEdge";
import type { EdgeProps, Node } from "@xyflow/react";
import type { CSSProperties } from "react";

const SMART_PATH = "M 264 46 L 300 46 L 300 194 L 368 194";
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

const routingNodes: Node[] = [
  {
    id: "source",
    data: {},
    position: { x: 0, y: 0 },
    measured: { width: 264, height: 92 },
  },
  {
    id: "obstacle",
    data: {},
    position: { x: 368, y: 0 },
    measured: { width: 264, height: 92 },
  },
  {
    id: "target",
    data: {},
    position: { x: 736, y: 148 },
    measured: { width: 264, height: 92 },
  },
];

vi.mock("@tisoap/react-flow-smart-edge", () => ({
  getSmartEdge: (input: unknown) => getSmartEdge(input),
  smartEdgePresets: {
    smoothstep: {
      drawEdge: vi.fn(),
      generatePath: vi.fn(),
    },
  },
}));

vi.mock("@xyflow/react", () => ({
  BaseEdge: ({ path, style }: { path: string; style?: CSSProperties }) => (
    <path data-testid="base-edge" d={path} data-stroke={style?.stroke} />
  ),
  getSmoothStepPath: () => ["fallback-path"],
  Position: { Left: "left", Right: "right" },
  useNodes: () => routingNodes,
}));

const edgeProps = {
  id: "source-target",
  source: "source",
  target: "target",
  sourceX: 264,
  sourceY: 46,
  targetX: 736,
  targetY: 194,
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
  it("routes around live node obstacles while preserving playback on the routed path", () => {
    const { container } = render(
      <svg>
        <TypedEdge {...edgeProps} />
      </svg>,
    );

    expect(getSmartEdge).toHaveBeenCalledWith(
      expect.objectContaining({
        nodes: routingNodes,
        sourceX: edgeProps.sourceX,
        sourceY: edgeProps.sourceY,
        targetX: edgeProps.targetX,
        targetY: edgeProps.targetY,
      }),
    );
    expect(screen.getByTestId("base-edge")).toHaveAttribute("d", SMART_PATH);
    expect(container.querySelectorAll("animateMotion")).toHaveLength(2);
    container.querySelectorAll("animateMotion").forEach((motion) => {
      expect(motion).toHaveAttribute("path", SMART_PATH);
      expect(motion).toHaveAttribute("dur", "500ms");
    });
  });
});
