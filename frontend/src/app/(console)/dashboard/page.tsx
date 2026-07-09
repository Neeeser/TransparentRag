"use client";

import { ArrowRight, FolderPlus, GitBranch } from "lucide-react";
import Link from "next/link";

import { DashboardActivity } from "@/components/dashboard/DashboardActivity";
import { DashboardCollections } from "@/components/dashboard/DashboardCollections";
import { DashboardSummary } from "@/components/dashboard/DashboardSummary";
import { Loader } from "@/components/ui/loader";
import { GlassCard } from "@/components/ui/panel";
import { useAuth } from "@/providers/auth-provider";

import { useDashboardData } from "./use-dashboard-data";

/** Prefer a first name for the greeting, falling back to email, then a generic. */
function greetingName(fullName?: string | null, email?: string | null): string {
  const first = fullName?.trim().split(/\s+/)[0];
  return first || email || "there";
}

export default function DashboardPage() {
  const { user } = useAuth();
  const {
    loading,
    error,
    collections,
    sessions,
    stats,
    recentDocuments,
    recentSessions,
    activeCollections,
    pipelineNameById,
  } = useDashboardData();

  return (
    <div className="space-y-6">
      <header className="landing-rise relative overflow-hidden rounded-3xl border border-hairline bg-surface px-6 py-10 sm:px-10">
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                "radial-gradient(55% 60% at 12% 0%, color-mix(in srgb, var(--accent-violet) 20%, transparent), transparent 60%)",
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                "radial-gradient(45% 55% at 92% 8%, color-mix(in srgb, var(--accent-cyan) 14%, transparent), transparent 60%)",
            }}
          />
        </div>

        <div className="relative">
          <h1 className="max-w-3xl text-balance text-4xl font-semibold tracking-tight text-primary sm:text-5xl">
            Welcome back,{" "}
            <span className="bg-gradient-to-r from-grad-from via-grad-via to-grad-to bg-clip-text text-transparent">
              {greetingName(user?.full_name, user?.email)}
            </span>
            .
          </h1>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/chat"
              className="group flex items-center gap-2 rounded-full bg-accent-violet px-5 py-2.5 text-sm font-semibold text-white shadow-glow transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-violet focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
            >
              Start a chat
              <ArrowRight
                className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                aria-hidden
              />
            </Link>
            <Link
              href="/collections"
              className="flex items-center gap-2 rounded-full border border-hairline bg-surface px-5 py-2.5 text-sm font-medium text-primary transition hover:border-strong hover:bg-surface-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-violet focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
            >
              <FolderPlus className="h-4 w-4" aria-hidden />
              New collection
            </Link>
            <Link
              href="/pipelines"
              className="flex items-center gap-2 rounded-full border border-hairline bg-surface px-5 py-2.5 text-sm font-medium text-primary transition hover:border-strong hover:bg-surface-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-violet focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
            >
              <GitBranch className="h-4 w-4" aria-hidden />
              Pipelines
            </Link>
          </div>
        </div>
      </header>

      {loading ? (
        <GlassCard className="flex items-center justify-center rounded-3xl p-10">
          <Loader className="h-6 w-6" />
        </GlassCard>
      ) : error ? (
        <GlassCard className="rounded-3xl p-8 text-sm text-data-neg">{error}</GlassCard>
      ) : (
        <>
          <div className="landing-rise" style={{ animationDelay: "60ms" }}>
            <DashboardSummary
              collectionCount={collections.length}
              docCount={stats.docCount}
              chunkCount={stats.totalChunks}
              sessionCount={sessions.length}
            />
          </div>
          <div className="landing-rise" style={{ animationDelay: "120ms" }}>
            <DashboardCollections
              collections={activeCollections}
              pipelineNameById={pipelineNameById}
            />
          </div>
          <div className="landing-rise" style={{ animationDelay: "180ms" }}>
            <DashboardActivity recentSessions={recentSessions} recentDocuments={recentDocuments} />
          </div>
        </>
      )}
    </div>
  );
}
