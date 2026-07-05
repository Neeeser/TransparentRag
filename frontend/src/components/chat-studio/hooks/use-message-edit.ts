"use client";

import { useCallback, useLayoutEffect, useRef } from "react";

interface UseMessageEditParams {
  editingMessageId: string | null;
  setEditingMessageId: React.Dispatch<React.SetStateAction<string | null>>;
  setEditingDraft: React.Dispatch<React.SetStateAction<string>>;
  autoScrollEnabled: boolean;
  setAutoScrollEnabled: (enabled: boolean) => void;
  messagesContainerRef: React.MutableRefObject<HTMLDivElement | null>;
  scrollAnimationFrameRef: React.MutableRefObject<number | null>;
}

export interface UseMessageEditResult {
  handleEditStart: (messageId: string, content: string) => void;
  handleEditCancel: () => void;
}

/**
 * Manages the message-edit interaction: snapshots and restores scroll position across
 * an edit, pauses/restores auto-scroll, and starts/cancels the inline editor.
 */
export function useMessageEdit(params: UseMessageEditParams): UseMessageEditResult {
  const {
    editingMessageId,
    setEditingMessageId,
    setEditingDraft,
    autoScrollEnabled,
    setAutoScrollEnabled,
    messagesContainerRef,
    scrollAnimationFrameRef,
  } = params;

  const editScrollSnapshotRef = useRef<{ scrollTop: number; scrollHeight: number } | null>(null);
  const editAutoScrollRef = useRef<boolean | null>(null);

  useLayoutEffect(() => {
    if (!editingMessageId) {
      editScrollSnapshotRef.current = null;
      if (editAutoScrollRef.current !== null) {
        setAutoScrollEnabled(editAutoScrollRef.current);
        editAutoScrollRef.current = null;
      }
      return;
    }
    const container = messagesContainerRef.current;
    const snapshot = editScrollSnapshotRef.current;
    if (!container || !snapshot) {
      return;
    }
    const previousBehavior = container.style.scrollBehavior;
    container.style.scrollBehavior = "auto";
    container.scrollTop = snapshot.scrollTop;
    container.style.scrollBehavior = previousBehavior;
    editScrollSnapshotRef.current = null;
  }, [editingMessageId, messagesContainerRef, setAutoScrollEnabled]);

  const handleEditStart = useCallback(
    (messageId: string, content: string) => {
      const container = messagesContainerRef.current;
      if (container) {
        editScrollSnapshotRef.current = {
          scrollTop: container.scrollTop,
          scrollHeight: container.scrollHeight,
        };
      }
      editAutoScrollRef.current = autoScrollEnabled;
      if (autoScrollEnabled) {
        setAutoScrollEnabled(false);
      }
      if (scrollAnimationFrameRef.current) {
        window.cancelAnimationFrame(scrollAnimationFrameRef.current);
        scrollAnimationFrameRef.current = null;
      }
      setEditingMessageId(messageId);
      setEditingDraft(content);
    },
    [
      autoScrollEnabled,
      messagesContainerRef,
      scrollAnimationFrameRef,
      setAutoScrollEnabled,
      setEditingDraft,
      setEditingMessageId,
    ],
  );

  const handleEditCancel = useCallback(() => {
    setEditingMessageId(null);
    setEditingDraft("");
  }, [setEditingDraft, setEditingMessageId]);

  return { handleEditStart, handleEditCancel };
}
