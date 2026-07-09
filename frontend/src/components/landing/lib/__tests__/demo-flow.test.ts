import { describe, expect, it } from "vitest";

import { buildDemoFlow } from "@/components/landing/lib/demo-flow";

describe("buildDemoFlow", () => {
  it("produces a connected left-to-right pipeline ending at chat", () => {
    const { nodes, edges } = buildDemoFlow();

    // Document → Parse → Chunk → Embed → Index → Retrieve → Chat.
    expect(nodes.map((node) => node.id)).toEqual([
      "source",
      "parse",
      "chunk",
      "embed",
      "index",
      "retrieve",
      "chat",
    ]);
    // One edge fewer than nodes: every consecutive pair is linked once.
    expect(edges).toHaveLength(nodes.length - 1);
  });

  it("orders steps to match node order so playback flows front to back", () => {
    const { nodes, steps } = buildDemoFlow();
    expect(steps.map((step) => step.nodeId)).toEqual(nodes.map((node) => node.id));
  });

  it("connects each step to the next via a real edge", () => {
    const { edges, steps } = buildDemoFlow();
    for (let i = 0; i < steps.length - 1; i += 1) {
      const from = steps[i].nodeId;
      const to = steps[i + 1].nodeId;
      const edge = edges.find((candidate) => candidate.source === from && candidate.target === to);
      expect(edge, `missing edge ${from} → ${to}`).toBeDefined();
    }
  });

  it("lays nodes out horizontally and gives every edge a data type for coloring", () => {
    const { nodes, edges } = buildDemoFlow();
    // Strictly increasing x, all on one row — reads as a conveyor.
    for (let i = 1; i < nodes.length; i += 1) {
      expect(nodes[i].position.x).toBeGreaterThan(nodes[i - 1].position.x);
      expect(nodes[i].position.y).toBe(nodes[0].position.y);
    }
    edges.forEach((edge) => {
      expect(edge.data?.dataType).toBeTruthy();
      expect(edge.type).toBe("typed");
    });
  });

  it("wires edge handles to ports that exist on the connected nodes", () => {
    const { nodes, edges } = buildDemoFlow();
    const byId = new Map(nodes.map((node) => [node.id, node]));
    edges.forEach((edge) => {
      const source = byId.get(edge.source);
      const target = byId.get(edge.target);
      expect(source?.data.outputs.some((port) => port.key === edge.sourceHandle)).toBe(true);
      expect(target?.data.inputs.some((port) => port.key === edge.targetHandle)).toBe(true);
    });
  });
});
