"use client";

import { useState } from "react";

import { formatPayload } from "@/components/traces/trace-payload-utils";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type TracePayloadBlockProps = {
  payload: unknown;
  highlight: boolean;
};

export function TracePayloadBlock({ payload, highlight }: TracePayloadBlockProps) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div
      className={cn(
        "rounded-2xl border border-white/10 bg-black/30 p-3 text-xs text-slate-200",
        highlight && "border-cyan-400/70 bg-cyan-500/10",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] uppercase tracking-[0.3em] text-slate-300">
          {expanded ? "Full payload" : "Preview"}
        </p>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setExpanded((prev) => !prev)}
          className="text-[10px] uppercase tracking-[0.3em]"
        >
          {expanded ? "Collapse" : "Expand"}
        </Button>
      </div>
      <pre className="mt-3 max-h-56 overflow-auto rounded-xl bg-black/40 p-3 text-[11px] text-slate-100">
        {formatPayload(payload, expanded)}
      </pre>
    </div>
  );
}
