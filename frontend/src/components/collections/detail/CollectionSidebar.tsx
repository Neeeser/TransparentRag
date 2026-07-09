"use client";

import { ArrowLeft, Files, Gauge, MessageSquare, ScatterChart, Search } from "lucide-react";
import { useRouter } from "next/navigation";

import { GlassCard } from "@/components/ui/panel";
import { cn } from "@/lib/utils";
import { useAppConfig } from "@/providers/config-provider";

import type { Collection } from "@/lib/types";

type CollectionView = "overview" | "search" | "documents" | "visualize";

type CollectionSidebarProps = {
  collection: Collection | null;
  activeView: CollectionView;
  onSelectView: (view: CollectionView) => void;
};

const baseNavItems: Array<{
  id: CollectionView;
  label: string;
  description: string;
  icon: typeof Gauge;
}> = [
  {
    id: "overview",
    label: "Overview",
    description: "Vitals and pipeline bindings.",
    icon: Gauge,
  },
  {
    id: "search",
    label: "Search",
    description: "Run retrieval queries.",
    icon: Search,
  },
  {
    id: "documents",
    label: "Documents",
    description: "Inspect ingested sources.",
    icon: Files,
  },
];

const visualizeNavItem = {
  id: "visualize" as const,
  label: "Visualize",
  description: "Explore the embedding map.",
  icon: ScatterChart,
};

export function CollectionSidebar({
  collection,
  activeView,
  onSelectView,
}: CollectionSidebarProps) {
  const router = useRouter();
  const { config } = useAppConfig();
  const navItems =
    config.features.umap_visualizations === false
      ? baseNavItems
      : [...baseNavItems, visualizeNavItem];

  return (
    <GlassCard className="rounded-3xl border border-hairline p-5">
      <button
        type="button"
        onClick={() => router.push("/collections")}
        className="flex w-full items-center gap-2 rounded-2xl border border-hairline px-3 py-2 text-sm text-body transition hover:border-strong hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-violet focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to collections
      </button>

      <div className="mt-5">
        <p className="font-mono text-[11px] uppercase tracking-[0.35em] text-muted">Collection</p>
        <h2 className="mt-2 text-lg font-semibold text-primary">
          {collection?.name || "Loading..."}
        </h2>
        <p className="text-sm text-muted">
          {collection?.description?.trim() || "No description yet."}
        </p>
      </div>

      <div className="mt-6 space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectView(item.id)}
              className={cn(
                "flex w-full items-start gap-3 rounded-2xl border px-4 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-violet focus-visible:ring-offset-2 focus-visible:ring-offset-canvas",
                isActive
                  ? "border-accent-violet bg-accent-violet/10 text-primary"
                  : "border-hairline bg-surface text-body hover:border-strong",
              )}
            >
              <Icon className="mt-0.5 h-4 w-4 text-accent-violet" />
              <div>
                <p className="text-sm font-semibold">{item.label}</p>
                <p className="text-xs text-muted">{item.description}</p>
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-6">
        <button
          type="button"
          onClick={() =>
            collection && router.push(`/chat?collections=${encodeURIComponent(collection.id)}`)
          }
          disabled={!collection}
          className={cn(
            "flex w-full items-start gap-3 rounded-2xl border px-4 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-violet focus-visible:ring-offset-2 focus-visible:ring-offset-canvas",
            collection
              ? "border-hairline bg-surface text-body hover:border-strong"
              : "cursor-not-allowed border-hairline bg-surface text-faint",
          )}
        >
          <MessageSquare className="mt-0.5 h-4 w-4 text-accent-violet" />
          <div>
            <p className="text-sm font-semibold">Chat studio</p>
            <p className="text-xs text-muted">Open with this collection pre-selected.</p>
          </div>
        </button>
      </div>
    </GlassCard>
  );
}

export type { CollectionView };
