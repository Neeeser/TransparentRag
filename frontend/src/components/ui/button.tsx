"use client";

import { Loader } from "@/components/ui/loader";
import { cn } from "@/lib/utils";

import type { ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}

export function Button({
  className,
  children,
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "rounded-full font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 disabled:cursor-not-allowed",
        {
          primary: "bg-violet-500 text-white hover:bg-violet-400 shadow-lg shadow-violet-500/30",
          secondary:
            "border border-white/10 bg-white/5 text-white hover:border-white/30 hover:bg-white/10",
          ghost: "text-slate-400 hover:text-white hover:bg-white/5",
        }[variant],
        {
          sm: "px-3 py-1.5 text-sm",
          md: "px-4 py-2 text-sm",
          lg: "px-5 py-3 text-base",
        }[size],
        className,
      )}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      <span className="inline-flex items-center justify-center gap-2">
        {loading ? <Loader className="h-3.5 w-3.5" /> : null}
        {children}
      </span>
    </button>
  );
}
