import type { PipelineDefinition } from "@/lib/types";

const HUGGINGFACE_TOKENIZER_TYPE = "tokenizer.huggingface";

/** Return each configured HuggingFace tokenizer repository id once. */
export const huggingFaceTokenizerModelIds = (definition: PipelineDefinition): string[] => {
  const ids = new Set<string>();
  definition.nodes.forEach((node) => {
    if (node.type !== HUGGINGFACE_TOKENIZER_TYPE) return;
    const value = node.config.hf_model_id;
    if (typeof value === "string" && value.trim()) {
      ids.add(value.trim());
    }
  });
  return [...ids];
};
