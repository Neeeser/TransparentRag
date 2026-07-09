"use client";

import { type RefObject } from "react";

import {
  CHAT_INPUT_MAX_HEIGHT,
  CHAT_INPUT_MIN_HEIGHT,
} from "@/components/chat-studio/lib/chat-constants";
import { Button } from "@/components/ui/button";

interface ChatInputProps {
  draft: string;
  setDraft: (value: string) => void;
  sending: boolean;
  isStopping: boolean;
  onSend: () => void;
  onStop: () => void;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  placeholder?: string;
}

export const ChatInput = ({
  draft,
  setDraft,
  sending,
  isStopping,
  onSend,
  onStop,
  inputRef,
  placeholder = "Ask anything…",
}: ChatInputProps) => {
  return (
    <div className="border-t border-hairline bg-surface px-6 py-4">
      <div className="flex flex-col gap-3">
        <textarea
          ref={inputRef}
          rows={1}
          className="w-full resize-none rounded-2xl border border-hairline bg-surface px-4 py-3 text-sm text-primary outline-none focus:border-accent-violet"
          placeholder={placeholder}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          style={{
            minHeight: CHAT_INPUT_MIN_HEIGHT,
            maxHeight: CHAT_INPUT_MAX_HEIGHT,
          }}
        />
        <div className="flex items-center justify-between text-xs text-muted">
          <span>{draft.length} characters</span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              onClick={sending ? onStop : onSend}
              disabled={!sending && !draft.trim()}
              className="gap-2"
            >
              {sending ? (isStopping ? "Stopping..." : "Stop") : "Send turn"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
