"use client";

import { PanelLeftClose, PlusCircle, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn, timeAgo } from "@/lib/utils";

import type { ChatSession } from "@/lib/types";

interface HistoryPanelProps {
  sessions: ChatSession[];
  selectedSessionId: string | null;
  onSelect: (sessionId: string) => void;
  onNewChat: () => void;
  onDelete: (sessionId: string) => void;
  deletingSessionId: string | null;
  onClose: () => void;
}

export const HistoryPanel = ({
  sessions,
  selectedSessionId,
  onSelect,
  onNewChat,
  onDelete,
  deletingSessionId,
  onClose,
}: HistoryPanelProps) => {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between border-b border-white/5 px-5 py-4">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-slate-500">History</p>
          <h2 className="text-xl font-semibold text-white">Chat sessions</h2>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 p-0 text-slate-300"
          onClick={onClose}
        >
          <PanelLeftClose className="h-4 w-4" />
        </Button>
      </div>
      <div className="border-b border-white/5 px-5 py-3">
        <Button
          variant="secondary"
          className="flex h-10 w-full items-center justify-center gap-2"
          onClick={onNewChat}
        >
          <PlusCircle className="h-4 w-4" />
          <span>New chat</span>
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {sessions.length === 0 ? (
          <p className="text-sm text-slate-400">No chats yet — start one below.</p>
        ) : (
          <div className="space-y-2">
            {sessions.map((session) => {
              const isSelected = selectedSessionId === session.id;
              return (
                <div
                  key={session.id}
                  className={cn(
                    "group flex items-center gap-2 rounded-2xl border px-2 py-2 text-sm transition",
                    isSelected
                      ? "border-violet-400 bg-violet-500/10 text-white"
                      : "border-white/5 bg-white/5 text-slate-300 hover:border-white/20",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => onSelect(session.id)}
                    className={cn(
                      "flex-1 rounded-xl px-2 py-1 text-left",
                      isSelected ? "text-white" : "text-slate-300 group-hover:text-white",
                    )}
                  >
                    <p className="text-base font-semibold">{session.title}</p>
                    <p
                      className={cn(
                        "text-xs",
                        isSelected ? "text-slate-300" : "text-slate-400 group-hover:text-slate-200",
                      )}
                    >
                      {session.chat_model} • {timeAgo(session.updated_at)}
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(session.id)}
                    disabled={deletingSessionId === session.id}
                    title="Delete chat"
                    aria-label={`Delete ${session.title}`}
                    className={cn(
                      "inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border text-slate-400 transition hover:text-rose-300 disabled:cursor-not-allowed disabled:opacity-50",
                      isSelected
                        ? "border-white/20 hover:border-rose-300/60"
                        : "border-white/10 hover:border-rose-300/60",
                    )}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
