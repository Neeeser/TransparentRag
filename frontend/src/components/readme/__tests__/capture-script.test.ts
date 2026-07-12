import { describe, expect, it } from "vitest";

import { captureDurationMs } from "../../../../scripts/capture-readme-pipeline.mjs";

describe("captureDurationMs", () => {
  it("covers every process and travel phase plus a short hold", () => {
    expect(captureDurationMs(6)).toBe(6100);
    expect(captureDurationMs(5)).toBe(5150);
  });
});
