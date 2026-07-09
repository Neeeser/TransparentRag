"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";

import type { ReasoningTraceSegment } from "@/lib/types";

interface CollapsibleReasoningProps {
  segments: ReasoningTraceSegment[];
  messageId: string;
  subtitle?: string;
  isAutoOpen?: boolean;
  preventAutoClose?: boolean;
  onManualToggle?: (messageId: string, isOpen: boolean) => void;
  title?: string;
  className?: string;
}

export function CollapsibleReasoning({
  segments,
  messageId,
  subtitle,
  isAutoOpen = false,
  preventAutoClose = false,
  onManualToggle,
  title = "Reasoning",
  className,
}: CollapsibleReasoningProps) {
  const [manualState, setManualState] = useState<boolean | null>(null);
  const isOpen =
    isAutoOpen || manualState !== null ? isAutoOpen || manualState === true : preventAutoClose;

  if (!segments || segments.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "w-full overflow-hidden rounded-2xl border border-stage-embed/40 bg-stage-embed/10 shadow-elevation-2",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => {
          const next = !isOpen;
          setManualState(next);
          onManualToggle?.(messageId, next);
        }}
        className="flex w-full items-center justify-between px-4 py-3 text-left transition hover:bg-stage-embed/15"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-3">
          <div className="flex flex-col leading-tight">
            <span className="font-mono text-[11px] uppercase tracking-[0.28em] text-stage-embed">
              {title}
            </span>
            {subtitle ? (
              <span className="text-base font-semibold text-primary">{subtitle}</span>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-stage-embed/20 px-2 py-0.5 text-xs text-stage-embed">
            {segments.length} {segments.length === 1 ? "step" : "steps"}
          </span>
          {isOpen ? (
            <ChevronDown className="h-4 w-4 text-stage-embed" />
          ) : (
            <ChevronRight className="h-4 w-4 text-stage-embed" />
          )}
        </div>
      </button>

      {isOpen && (
        <div className="border-t border-stage-embed/30 px-4 py-3 space-y-3">
          {segments.map((segment, idx) => {
            const preferredText =
              (typeof segment.text === "string" && segment.text) ||
              (typeof segment.content === "string" && segment.content) ||
              null;
            const reasoningText =
              preferredText && preferredText.trim().length > 0
                ? preferredText
                : (preferredText ?? JSON.stringify(segment, null, 2));

            return (
              <div
                key={`${messageId}-reasoning-${idx}`}
                className="rounded-xl border border-stage-embed/20 bg-stage-embed/10 px-3 py-2"
              >
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-xs font-semibold text-stage-embed">Step {idx + 1}</span>
                  {segment.type && (
                    <span className="rounded bg-stage-embed/20 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-stage-embed">
                      {segment.type}
                    </span>
                  )}
                </div>
                <pre className="whitespace-pre-wrap text-sm leading-relaxed text-body">
                  {reasoningText}
                </pre>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
