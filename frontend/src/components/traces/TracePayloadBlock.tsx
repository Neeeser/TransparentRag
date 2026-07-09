"use client";

import { TraceValueView } from "@/components/traces/values/TraceValueView";
import { cn } from "@/lib/utils";

type TracePayloadBlockProps = {
  payload: unknown;
  highlight: boolean;
  highlightChunkId?: string | null;
};

/** Raw IO payload, rendered through the same value-view registry as summaries
 * so recognized shapes get a pretty view and everything else normalized JSON. */
export function TracePayloadBlock({
  payload,
  highlight,
  highlightChunkId,
}: TracePayloadBlockProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-hairline bg-surface p-3",
        highlight && "border-accent-cyan/70 bg-accent-cyan/10",
      )}
    >
      <TraceValueView value={payload} kind="json" highlightChunkId={highlightChunkId} />
    </div>
  );
}
