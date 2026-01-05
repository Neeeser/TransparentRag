"use client";

import { X } from "lucide-react";

import { GlassCard } from "@/components/ui/panel";
import { cn } from "@/lib/utils";

import type { ReactNode } from "react";

export type WizardStep = {
  id: string;
  label: string;
  description: string;
};

type WizardShellProps = {
  open: boolean;
  title: string;
  subtitle: string;
  steps: WizardStep[];
  activeStepIndex: number;
  message?: string | null;
  onStepChange: (index: number) => void;
  onClose: () => void;
  children: ReactNode;
  footer: ReactNode;
};

export function WizardShell({
  open,
  title,
  subtitle,
  steps,
  activeStepIndex,
  message,
  onStepChange,
  onClose,
  children,
  footer,
}: WizardShellProps) {
  if (!open) return null;
  const activeStep = steps[activeStepIndex];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 py-10 backdrop-blur-sm"
      role="presentation"
      onClick={onClose}
    >
      <GlassCard
        role="dialog"
        aria-modal="true"
        className="w-full max-w-5xl rounded-[2.5rem] border border-white/10 bg-slate-950/95 p-6 text-white"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-slate-400">{title}</p>
            <h2 className="mt-2 text-2xl font-semibold">{subtitle}</h2>
            <p className="text-sm text-slate-400">{activeStep?.description}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/10 p-2 text-slate-300 transition hover:border-white/30 hover:text-white"
            aria-label="Close wizard"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {message ? (
          <div className="mt-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-100">
            {message}
          </div>
        ) : null}

        <div className="mt-6 grid gap-6 lg:grid-cols-[240px_1fr]">
          <div className="space-y-3">
            {steps.map((step, index) => {
              const isActive = index === activeStepIndex;
              const isComplete = index < activeStepIndex;
              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => onStepChange(index)}
                  className={cn(
                    "w-full rounded-2xl border px-4 py-3 text-left transition",
                    isActive
                      ? "border-violet-400 bg-violet-500/10 text-white"
                      : "border-white/10 bg-white/5 text-slate-300 hover:border-white/30",
                  )}
                >
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                    Step {index + 1}
                  </p>
                  <p className="text-base font-semibold">{step.label}</p>
                  <p className="text-xs text-slate-400">{isComplete ? "Complete" : "Pending"}</p>
                </button>
              );
            })}
          </div>

          <div className="space-y-6">
            {children}
            {footer}
          </div>
        </div>
      </GlassCard>
    </div>
  );
}
