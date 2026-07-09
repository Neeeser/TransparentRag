/**
 * Shared color coding for pipeline change kinds -- used by the save panel's
 * pending list and the revision history so "what changed" reads the same
 * everywhere. Kinds come from the backend diff (`PipelineChangeRead.kind`)
 * and its client mirror (`pipeline-diff.ts`).
 */
export const changeKindDot = (kind: string): string => {
  switch (kind) {
    case "node_added":
    case "edge_added":
    case "created":
      return "bg-data-pos";
    case "node_removed":
    case "edge_removed":
      return "bg-data-neg";
    case "layout":
      return "bg-stage-neutral";
    default:
      return "bg-data-warn";
  }
};
