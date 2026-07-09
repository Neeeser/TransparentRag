import Link from "next/link";

import { GlassCard } from "@/components/ui/panel";

type DashboardSummaryProps = {
  collectionCount: number;
  docCount: number;
  chunkCount: number;
  sessionCount: number;
};

/**
 * Three orienting counts of the user's workspace. Each tile links to the area it
 * summarizes so the numbers double as navigation, not a read-only readout.
 */
export function DashboardSummary({
  collectionCount,
  docCount,
  chunkCount,
  sessionCount,
}: DashboardSummaryProps) {
  const tiles = [
    { label: "Collections", value: collectionCount, detail: null, href: "/collections" },
    {
      label: "Documents",
      value: docCount,
      detail: chunkCount > 0 ? `${chunkCount.toLocaleString()} chunks indexed` : null,
      href: "/collections",
    },
    { label: "Chat sessions", value: sessionCount, detail: null, href: "/chat" },
  ];

  return (
    <section className="grid gap-4 sm:grid-cols-3">
      {tiles.map((tile) => (
        <Link
          key={tile.label}
          href={tile.href}
          className="rounded-3xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-violet focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
        >
          <GlassCard className="h-full rounded-3xl p-6 transition hover:border-strong hover:bg-surface-strong">
            <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-muted">
              {tile.label}
            </p>
            <p className="mt-3 text-4xl font-semibold tracking-tight text-primary">{tile.value}</p>
            <p className="mt-1 text-sm text-meta">{tile.detail ?? " "}</p>
          </GlassCard>
        </Link>
      ))}
    </section>
  );
}
