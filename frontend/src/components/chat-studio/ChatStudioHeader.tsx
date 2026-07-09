"use client";

import { PlusCircle } from "lucide-react";

import { Button } from "@/components/ui/button";

type ChatStudioHeaderProps = {
  collectionLabel: string;
  collectionMetaLabel: string;
  currentModelLabel: string;
  showNewChatButton: boolean;
  onModelSelect: () => void;
  onNewChat: () => void;
};

export function ChatStudioHeader({
  collectionLabel,
  collectionMetaLabel,
  currentModelLabel,
  showNewChatButton,
  onModelSelect,
  onNewChat,
}: ChatStudioHeaderProps) {
  return (
    <div className="flex items-center justify-between border-b border-hairline px-6 py-4">
      <div className="flex items-start gap-3">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.35em] text-meta">Conversation</p>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-2xl font-semibold text-primary">{collectionLabel}</h2>
            <span className="font-mono text-xs uppercase tracking-[0.3em] text-meta">
              {collectionMetaLabel}
            </span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onModelSelect}
          className="hidden min-w-0 items-center gap-3 rounded-2xl border border-hairline bg-surface px-3 py-2 text-left text-xs text-body transition hover:border-strong hover:text-primary sm:flex"
        >
          <span className="font-mono text-[10px] uppercase tracking-[0.35em] text-meta">Model</span>
          <span className="min-w-0 truncate text-sm font-semibold text-primary">
            {currentModelLabel}
          </span>
        </button>
        {showNewChatButton && (
          <Button
            variant="secondary"
            className="flex h-10 items-center justify-center gap-2 px-3 whitespace-nowrap"
            onClick={onNewChat}
          >
            <PlusCircle className="h-4 w-4" />
            <span className="hidden sm:inline">New chat</span>
          </Button>
        )}
      </div>
    </div>
  );
}
