"use client";

import { cn } from "@/lib/utils";

import type { ReactNode } from "react";

interface SetupStepShellProps {
  /** Remounts the shell per step so the entrance animation replays. */
  stepKey: string;
  direction: 1 | -1;
  kicker: string;
  title: ReactNode;
  children: ReactNode;
  footer: ReactNode;
}

/** Shared frame for one wizard step: kicker, title, body, action row. */
export function SetupStepShell({
  stepKey,
  direction,
  kicker,
  title,
  children,
  footer,
}: SetupStepShellProps) {
  return (
    <section
      key={stepKey}
      className={cn(
        "flex w-full max-w-xl flex-col gap-6",
        direction === 1 ? "setup-step-forward" : "setup-step-back",
      )}
    >
      <header className="space-y-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.4em] text-muted">{kicker}</p>
        <h1 className="text-balance text-3xl font-semibold tracking-tight text-primary sm:text-4xl">
          {title}
        </h1>
      </header>
      <div className="space-y-4">{children}</div>
      <footer className="flex items-center justify-between gap-3 pt-2">{footer}</footer>
    </section>
  );
}
