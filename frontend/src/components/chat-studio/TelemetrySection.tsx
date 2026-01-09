"use client";

import { ChevronDown, ChevronRight } from "lucide-react";

import type { ReactNode } from "react";

interface TelemetrySectionProps {
  title: string;
  description?: ReactNode;
  icon?: ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  sectionId?: string;
  overrideActive?: boolean;
  headerAction?: ReactNode;
  isDragging?: boolean;
  children: ReactNode;
}

export const TelemetrySection = ({
  title,
  description,
  icon,
  isOpen,
  onToggle,
  sectionId,
  overrideActive,
  headerAction,
  isDragging = false,
  children,
}: TelemetrySectionProps) => (
  <div
    id={sectionId}
    className={`rounded-2xl border border-white/10 bg-white/5 ${
      isDragging ? "border-emerald-400/60 bg-emerald-500/5" : ""
    }`}
  >
    <div className="flex w-full items-center justify-between gap-3 rounded-2xl border-b border-white/5 px-4 py-3 transition hover:bg-white/10">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className="flex flex-1 items-center gap-2 text-left"
      >
        {icon && <span className="text-slate-300">{icon}</span>}
        <div>
          <div className="flex items-center gap-2">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">{title}</p>
            {overrideActive && (
              <span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_10px_rgba(52,211,153,0.9)]" />
            )}
          </div>
          {description && <p className="text-[11px] text-slate-300">{description}</p>}
        </div>
      </button>
      <div className="flex items-center gap-2">
        {headerAction}
        <button
          type="button"
          onClick={onToggle}
          aria-label={`${title} toggle`}
          className="flex h-7 w-7 items-center justify-center rounded-full text-slate-300 transition hover:bg-white/10"
        >
          {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
      </div>
    </div>
    {isOpen && <div className="space-y-3 px-4 pb-4 pt-3">{children}</div>}
  </div>
);
