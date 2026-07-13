import { getSmartEdge } from "@tisoap/react-flow-smart-edge";
import { Position } from "@xyflow/react";
import { describe, expect, it } from "vitest";

import { PIPELINE_EDGE_ROUTING_OPTIONS } from "@/components/pipelines/flow/TypedEdge";
import {
  ESTIMATED_NODE_WIDTH,
  LAYER_GAP_X,
  estimateNodeHeight,
  layoutPipelineNodes,
  needsAutoLayout,
} from "@/components/pipelines/lib/pipeline-layout";

import type { PipelineNodeData } from "@/components/pipelines/PipelineNode";
import type { Edge, Node } from "@xyflow/react";

type LayoutNode = Node<PipelineNodeData>;
type Fixture = { name: string; nodes: LayoutNode[]; edges: Edge[] };
type Rect = { left: number; right: number; top: number; bottom: number };
type Point = { x: number; y: number };

const makePort = (key: string) => ({
  key,
  label: key,
  data_type: "document",
  required: true,
  accepts_many: false,
});

const makeNode = (id: string, position = { x: 0, y: 0 }): LayoutNode => ({
  id,
  type: "pipelineNode",
  position,
  data: {
    label: id,
    nodeType: "fixture.node",
    inputs: [makePort("input")],
    outputs: [makePort("output")],
    config: {},
  },
});

const edge = (source: string, target: string): Edge => ({
  id: `${source}-${target}`,
  source,
  target,
});

const fixture = (name: string, nodeIds: string[], pairs: Array<[string, string]>): Fixture => ({
  name,
  nodes: nodeIds.map((id) => makeNode(id)),
  edges: pairs.map(([source, target]) => edge(source, target)),
});

const HYBRID_NODE = {
  parser: "parser",
  chunker: "chunker",
  embedder: "embedder",
  semantic: "semantic-index",
  bm25: "bm25-index",
  output: "output",
} as const;

const fixtures: Fixture[] = [
  fixture(
    "linear pipeline",
    ["a", "b", "c"],
    [
      ["a", "b"],
      ["b", "c"],
    ],
  ),
  fixture(
    "fan-out",
    ["source", "left", "right"],
    [
      ["source", "left"],
      ["source", "right"],
    ],
  ),
  fixture(
    "fan-in",
    ["left", "right", "merge"],
    [
      ["left", "merge"],
      ["right", "merge"],
    ],
  ),
  fixture(
    "diamond",
    ["root", "left", "right", "merge"],
    [
      ["root", "left"],
      ["root", "right"],
      ["left", "merge"],
      ["right", "merge"],
    ],
  ),
  fixture(
    "unequal branch depths",
    ["root", "short", "long-1", "long-2", "merge"],
    [
      ["root", "short"],
      ["root", "long-1"],
      ["long-1", "long-2"],
      ["short", "merge"],
      ["long-2", "merge"],
    ],
  ),
  fixture(
    "nested branch and merge",
    ["root", "a", "b", "merge-1", "c", "d", "merge-2"],
    [
      ["root", "a"],
      ["root", "b"],
      ["a", "merge-1"],
      ["b", "merge-1"],
      ["merge-1", "c"],
      ["merge-1", "d"],
      ["c", "merge-2"],
      ["d", "merge-2"],
    ],
  ),
  fixture(
    "consecutive merges",
    ["root", "a", "b", "c", "merge-1", "merge-2"],
    [
      ["root", "a"],
      ["root", "b"],
      ["root", "c"],
      ["a", "merge-1"],
      ["b", "merge-1"],
      ["merge-1", "merge-2"],
      ["c", "merge-2"],
    ],
  ),
  fixture(
    "disconnected components",
    ["one-root", "two-root", "one-left", "two-next", "one-right", "one-merge"],
    [
      ["one-root", "one-left"],
      ["one-root", "one-right"],
      ["one-left", "one-merge"],
      ["one-right", "one-merge"],
      ["two-root", "two-next"],
    ],
  ),
  fixture(
    "shipped hybrid ingestion topology",
    [
      HYBRID_NODE.parser,
      HYBRID_NODE.chunker,
      HYBRID_NODE.embedder,
      HYBRID_NODE.semantic,
      HYBRID_NODE.bm25,
      HYBRID_NODE.output,
    ],
    [
      [HYBRID_NODE.parser, HYBRID_NODE.chunker],
      [HYBRID_NODE.chunker, HYBRID_NODE.embedder],
      [HYBRID_NODE.chunker, HYBRID_NODE.bm25],
      [HYBRID_NODE.embedder, HYBRID_NODE.semantic],
      [HYBRID_NODE.semantic, HYBRID_NODE.output],
      [HYBRID_NODE.bm25, HYBRID_NODE.output],
    ],
  ),
];

const nodeRect = (node: LayoutNode): Rect => ({
  left: node.position.x,
  right: node.position.x + ESTIMATED_NODE_WIDTH,
  top: node.position.y,
  bottom: node.position.y + estimateNodeHeight(node.data),
});

const rectsOverlap = (a: Rect, b: Rect) =>
  a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

const segmentIntersectsRect = (start: Point, end: Point, rect: Rect) => {
  const epsilon = 0.01;
  const inner = {
    left: rect.left + epsilon,
    right: rect.right - epsilon,
    top: rect.top + epsilon,
    bottom: rect.bottom - epsilon,
  };
  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;
  let near = 0;
  let far = 1;
  const boundaries: Array<[number, number]> = [
    [-deltaX, start.x - inner.left],
    [deltaX, inner.right - start.x],
    [-deltaY, start.y - inner.top],
    [deltaY, inner.bottom - start.y],
  ];
  for (const [direction, distance] of boundaries) {
    if (direction === 0 && distance < 0) return false;
    if (direction === 0) continue;
    const ratio = distance / direction;
    if (direction < 0) near = Math.max(near, ratio);
    else far = Math.min(far, ratio);
    if (near > far) return false;
  }
  return true;
};

const assertNoNodeOverlap = (nodes: LayoutNode[]) => {
  for (let first = 0; first < nodes.length; first += 1) {
    for (let second = first + 1; second < nodes.length; second += 1) {
      expect(
        rectsOverlap(nodeRect(nodes[first]), nodeRect(nodes[second])),
        `${nodes[first].id} overlaps ${nodes[second].id}`,
      ).toBe(false);
    }
  }
};

const routePoints = (nodes: LayoutNode[], connection: Edge): Point[] => {
  const source = nodes.find((node) => node.id === connection.source);
  const target = nodes.find((node) => node.id === connection.target);
  expect(source).toBeDefined();
  expect(target).toBeDefined();
  const sourceHeight = estimateNodeHeight(source!.data);
  const targetHeight = estimateNodeHeight(target!.data);
  const sourcePoint = {
    x: source!.position.x + ESTIMATED_NODE_WIDTH,
    y: source!.position.y + sourceHeight / 2,
  };
  const targetPoint = {
    x: target!.position.x,
    y: target!.position.y + targetHeight / 2,
  };
  const routingNodes: Node[] = nodes.map((node) => ({
    id: node.id,
    data: {},
    position: node.position,
    measured: { width: ESTIMATED_NODE_WIDTH, height: estimateNodeHeight(node.data) },
  }));
  const routed = getSmartEdge({
    nodes: routingNodes,
    sourceX: sourcePoint.x,
    sourceY: sourcePoint.y,
    targetX: targetPoint.x,
    targetY: targetPoint.y,
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
    options: PIPELINE_EDGE_ROUTING_OPTIONS,
  });
  expect(routed).not.toBeInstanceOf(Error);
  if (routed instanceof Error) return [];
  return [sourcePoint, ...routed.points.map(([x, y]) => ({ x, y })), targetPoint];
};

const assertEdgesAvoidUnrelatedNodes = (nodes: LayoutNode[], edges: Edge[]) => {
  edges.forEach((connection) => {
    const points = routePoints(nodes, connection);
    nodes
      .filter((node) => node.id !== connection.source && node.id !== connection.target)
      .forEach((node) => {
        for (let index = 1; index < points.length; index += 1) {
          expect(
            segmentIntersectsRect(points[index - 1], points[index], nodeRect(node)),
            `${connection.id} intersects unrelated node ${node.id}`,
          ).toBe(false);
        }
      });
  });
};

const centerY = (node: LayoutNode) => node.position.y + estimateNodeHeight(node.data) / 2;

describe("layoutPipelineNodes", () => {
  it.each(fixtures)("keeps nodes and routed edges clear for $name", ({ nodes, edges }) => {
    const laid = layoutPipelineNodes(nodes, edges);

    assertNoNodeOverlap(laid);
    assertEdgesAvoidUnrelatedNodes(laid, edges);
  });

  it("lays a linear pipeline out as one straight left-to-right row", () => {
    const linear = fixtures[0];
    const laid = layoutPipelineNodes(linear.nodes, linear.edges);
    const columnWidth = ESTIMATED_NODE_WIDTH + LAYER_GAP_X;

    expect(laid.map((node) => node.position.x)).toEqual([0, columnWidth, columnWidth * 2]);
    expect(new Set(laid.map((node) => node.position.y)).size).toBe(1);
  });

  it("centers a fan-out source between its parallel branches", () => {
    const fanOut = fixtures[1];
    const byId = new Map(
      layoutPipelineNodes(fanOut.nodes, fanOut.edges).map((node) => [node.id, node]),
    );
    const branchMidpoint = (centerY(byId.get("left")!) + centerY(byId.get("right")!)) / 2;

    expect(centerY(byId.get("source")!)).toBe(branchMidpoint);
  });

  it("centers a fan-in merge between all of its inputs", () => {
    const fanIn = fixtures[2];
    const byId = new Map(
      layoutPipelineNodes(fanIn.nodes, fanIn.edges).map((node) => [node.id, node]),
    );
    const inputMidpoint = (centerY(byId.get("left")!) + centerY(byId.get("right")!)) / 2;

    expect(centerY(byId.get("merge")!)).toBe(inputMidpoint);
  });

  it("places the hybrid output between both index branches", () => {
    const hybrid = fixtures[8];
    const byId = new Map(
      layoutPipelineNodes(hybrid.nodes, hybrid.edges).map((node) => [node.id, node]),
    );
    const branchCenters = [
      centerY(byId.get(HYBRID_NODE.semantic)!),
      centerY(byId.get(HYBRID_NODE.bm25)!),
    ];
    const outputCenter = centerY(byId.get(HYBRID_NODE.output)!);

    expect(outputCenter).toBeGreaterThan(Math.min(...branchCenters));
    expect(outputCenter).toBeLessThan(Math.max(...branchCenters));
  });

  it("packs disconnected components into separate vertical bands", () => {
    const disconnected = fixtures[7];
    const byId = new Map(
      layoutPipelineNodes(disconnected.nodes, disconnected.edges).map((node) => [node.id, node]),
    );
    const first = ["one-root", "one-left", "one-right", "one-merge"].map((id) =>
      nodeRect(byId.get(id)!),
    );
    const second = ["two-root", "two-next"].map((id) => nodeRect(byId.get(id)!));
    const firstBand = {
      top: Math.min(...first.map((rect) => rect.top)),
      bottom: Math.max(...first.map((rect) => rect.bottom)),
    };
    const secondBand = {
      top: Math.min(...second.map((rect) => rect.top)),
      bottom: Math.max(...second.map((rect) => rect.bottom)),
    };

    expect(firstBand.bottom <= secondBand.top || secondBand.bottom <= firstBand.top).toBe(true);
  });

  it("returns identical positions when Tidy is repeated", () => {
    fixtures.forEach(({ nodes, edges }) => {
      const first = layoutPipelineNodes(nodes, edges);
      const second = layoutPipelineNodes(first, edges);

      expect(second.map(({ id, position }) => ({ id, position }))).toEqual(
        first.map(({ id, position }) => ({ id, position })),
      );
    });
  });

  it("keeps a representative larger DAG fast and within a bounded extent", () => {
    const layers = 16;
    const width = 5;
    const nodes = Array.from({ length: layers * width }, (_, index) => makeNode(`node-${index}`));
    const edges = Array.from({ length: (layers - 1) * width }, (_, index) => {
      const layer = Math.floor(index / width);
      const offset = index % width;
      return edge(
        `node-${layer * width + offset}`,
        `node-${(layer + 1) * width + ((offset + layer) % width)}`,
      );
    });
    const started = performance.now();
    const laid = layoutPipelineNodes(nodes, edges);
    const elapsed = performance.now() - started;
    const rects = laid.map(nodeRect);

    expect(elapsed).toBeLessThan(250);
    expect(
      Math.max(...rects.map((rect) => rect.right)) - Math.min(...rects.map((rect) => rect.left)),
    ).toBeLessThan(10_000);
    expect(
      Math.max(...rects.map((rect) => rect.bottom)) - Math.min(...rects.map((rect) => rect.top)),
    ).toBeLessThan(10_000);
    assertNoNodeOverlap(laid);
  });
});

describe("needsAutoLayout", () => {
  it("triggers when every node piles up at the origin", () => {
    expect(needsAutoLayout([makeNode("a"), makeNode("b")])).toBe(true);
  });

  it("triggers when saved positions overlap", () => {
    const nodes = [makeNode("a", { x: 0, y: 0 }), makeNode("b", { x: 140, y: 0 })];
    expect(needsAutoLayout(nodes)).toBe(true);
  });

  it("keeps user-arranged positions that do not collide", () => {
    const nodes = [makeNode("a", { x: 0, y: 0 }), makeNode("b", { x: 400, y: 120 })];
    expect(needsAutoLayout(nodes)).toBe(false);
  });

  it("never relayouts a single node", () => {
    expect(needsAutoLayout([makeNode("a")])).toBe(false);
  });
});
