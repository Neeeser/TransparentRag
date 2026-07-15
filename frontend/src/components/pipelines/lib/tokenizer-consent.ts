import type { NodeSpec, PipelineDefinition } from "@/lib/types";

/** Return each configured HuggingFace tokenizer repository id once. */
export const huggingFaceTokenizerModelIds = (
  definition: PipelineDefinition,
  nodeSpecs: Pick<NodeSpec, "type" | "requires_model_id">[],
): string[] => {
  const modelIdNodeTypes = new Set(
    nodeSpecs.filter((spec) => spec.requires_model_id).map((spec) => spec.type),
  );
  const ids = new Set<string>();
  definition.nodes.forEach((node) => {
    if (!modelIdNodeTypes.has(node.type)) return;
    const value = node.config.hf_model_id;
    if (typeof value === "string" && value.trim()) {
      ids.add(value.trim());
    }
  });
  return [...ids];
};
