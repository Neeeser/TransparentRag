import { ArrowRight, MessageSquarePlus } from "lucide-react";
import Link from "next/link";

import { GlassCard } from "@/components/ui/panel";
import { cn, timeAgo } from "@/lib/utils";

import type { ChatSession, Document, DocumentStatus } from "@/lib/types";

type DashboardActivityProps = {
  recentSessions: ChatSession[];
  recentDocuments: Document[];
};

const STATUS_TONE: Record<DocumentStatus, string> = {
  ready: "text-data-pos",
  failed: "text-data-neg",
  processing: "text-data-warn",
  pending: "text-muted",
};

/**
 * Recent activity: the chat sessions and document ingests the user is most likely
 * to return to. Each row is a link back into the flow that produced it.
 */
export function DashboardActivity({ recentSessions, recentDocuments }: DashboardActivityProps) {
  return (
    <section className="grid gap-6 lg:grid-cols-2">
      <GlassCard className="rounded-3xl p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight text-primary">Recent chats</h2>
          {recentSessions.length > 0 ? (
            <Link
              href="/chat"
              className="flex items-center gap-1.5 rounded-full text-sm text-accent-violet transition hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-violet focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
            >
              Open chat studio
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          ) : null}
        </div>

        <div className="mt-6 space-y-2">
          {recentSessions.length === 0 ? (
            <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-hairline px-6 py-10 text-center">
              <p className="text-body">Ask your collections a question to start a session.</p>
              <Link
                href="/chat"
                className="flex items-center gap-2 rounded-full border border-hairline bg-surface px-5 py-2.5 text-sm font-medium text-primary transition hover:border-strong hover:bg-surface-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-violet focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
              >
                <MessageSquarePlus className="h-4 w-4" aria-hidden />
                Start a chat
              </Link>
            </div>
          ) : (
            recentSessions.map((session) => (
              <Link
                key={session.id}
                href={`/chat/${session.id}`}
                className="flex items-center justify-between gap-3 rounded-2xl border border-hairline bg-surface px-4 py-3 transition hover:border-strong hover:bg-surface-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-violet focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-primary">
                    {session.title || "Untitled session"}
                  </p>
                  <p className="mt-0.5 truncate font-mono text-[11px] uppercase tracking-[0.2em] text-meta">
                    {session.chat_model}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-meta">{timeAgo(session.updated_at)}</span>
              </Link>
            ))
          )}
        </div>
      </GlassCard>

      <GlassCard className="rounded-3xl p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight text-primary">Recent documents</h2>
        </div>

        <div className="mt-6 space-y-2">
          {recentDocuments.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-hairline px-6 py-10 text-center text-body">
              Uploaded sources land here as they finish processing.
            </p>
          ) : (
            recentDocuments.map((doc) => (
              <Link
                key={doc.id}
                href={`/collections/${doc.collection_id}`}
                className="flex items-center justify-between gap-3 rounded-2xl border border-hairline bg-surface px-4 py-3 transition hover:border-strong hover:bg-surface-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-violet focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-primary">{doc.name}</p>
                  <p className="mt-0.5 text-xs text-meta">
                    {doc.num_chunks} chunks · {timeAgo(doc.created_at)}
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 font-mono text-[10px] uppercase tracking-[0.2em]",
                    STATUS_TONE[doc.status],
                  )}
                >
                  {doc.status}
                </span>
              </Link>
            ))
          )}
        </div>
      </GlassCard>
    </section>
  );
}
