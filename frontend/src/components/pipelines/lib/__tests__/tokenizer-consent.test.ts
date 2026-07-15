import { describe, expect, it } from "vitest";

import { huggingFaceTokenizerModelIds } from "@/components/pipelines/lib/tokenizer-consent";

const huggingFaceType = "tokenizer.huggingface";
const modelId = "owner/model";

describe("huggingFaceTokenizerModelIds", () => {
  it("returns unique configured HuggingFace model ids", () => {
    expect(
      huggingFaceTokenizerModelIds({
        nodes: [
          {
            id: "a",
            type: huggingFaceType,
            name: "A",
            config: { hf_model_id: modelId },
          },
          {
            id: "b",
            type: "tokenizer.wordpiece",
            name: "B",
            config: {},
          },
          {
            id: "c",
            type: huggingFaceType,
            name: "C",
            config: { hf_model_id: modelId },
          },
        ],
        edges: [],
      }),
    ).toEqual([modelId]);
  });

  it("ignores blank or non-string model ids", () => {
    expect(
      huggingFaceTokenizerModelIds({
        nodes: [
          {
            id: "a",
            type: huggingFaceType,
            name: "A",
            config: { hf_model_id: "  " },
          },
          {
            id: "b",
            type: huggingFaceType,
            name: "B",
            config: { hf_model_id: 42 },
          },
        ],
        edges: [],
      }),
    ).toEqual([]);
  });
});
