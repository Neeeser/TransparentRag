'use client';

import type { ReactNode } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface TelemetrySectionProps {
  title: string;
  description?: ReactNode;
  icon?: ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  children: ReactNode;
}

export const TelemetrySection = ({
  title,
  description,
  icon,
  isOpen,
  onToggle,
  children,
}: TelemetrySectionProps) => (
  <div className="rounded-2xl border border-white/10 bg-white/5">
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={isOpen}
      className="flex w-full items-center justify-between gap-3 rounded-2xl border-b border-white/5 px-4 py-3 text-left transition hover:bg-white/10"
    >
      <div className="flex flex-1 items-center gap-2">
        {icon && <span className="text-slate-300">{icon}</span>}
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">{title}</p>
          {description && (
            <p className="text-[11px] text-slate-300">{description}</p>
          )}
        </div>
      </div>
      {isOpen ? (
        <ChevronDown className="h-4 w-4 text-slate-300" />
      ) : (
        <ChevronRight className="h-4 w-4 text-slate-300" />
      )}
    </button>
    {isOpen && <div className="space-y-3 px-4 pb-4 pt-3">{children}</div>}
  </div>
);
