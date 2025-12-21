"use client";

import { cn } from "@/lib/utils";

export function Loader({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-transparent",
        className,
      )}
    />
  );
}
