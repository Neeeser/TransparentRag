"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { ReasoningTraceSegment } from "@/lib/types";

interface UseAutoScrollParams {
  /** The active session id; switching sessions re-enables auto-scroll. */
  selectedSessionId: string | null;
  /** Content signals that should keep the view pinned to the bottom while streaming. */
  chatEntryOrder: string[];
  liveResponse: string;
  liveReasoningSegments: ReasoningTraceSegment[];
}

interface UseAutoScrollResult {
  autoScrollEnabled: boolean;
  setAutoScrollEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  endRef: React.RefObject<HTMLDivElement | null>;
  messagesContainerRef: React.RefObject<HTMLDivElement | null>;
  scrollAnimationFrameRef: React.MutableRefObject<number | null>;
  scrollToBottom: (behavior?: ScrollBehavior) => void;
  markProgrammaticScroll: (duration?: number) => void;
  handleScroll: () => void;
  handleReenableAutoScroll: () => void;
}

/**
 * Owns the message list scroll behavior: the container/end refs, programmatic
 * scroll bookkeeping, the "follow" state, and the effects that keep the view pinned
 * to the bottom while content streams in. The exposed refs and setter are also
 * consumed by the orchestrator's edit-scroll snapshot logic.
 */
export function useAutoScroll({
  selectedSessionId,
  chatEntryOrder,
  liveResponse,
  liveReasoningSegments,
}: UseAutoScrollParams): UseAutoScrollResult {
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(true);
  const endRef = useRef<HTMLDivElement | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const scrollAnimationFrameRef = useRef<number | null>(null);
  const programmaticScrollRef = useRef(false);
  const programmaticScrollTimeoutRef = useRef<number | null>(null);

  const markProgrammaticScroll = useCallback((duration = 150) => {
    if (programmaticScrollTimeoutRef.current) {
      window.clearTimeout(programmaticScrollTimeoutRef.current);
    }
    programmaticScrollRef.current = true;
    programmaticScrollTimeoutRef.current = window.setTimeout(() => {
      programmaticScrollRef.current = false;
      programmaticScrollTimeoutRef.current = null;
    }, duration);
  }, []);

  const scrollToBottom = useCallback(
    (behavior: ScrollBehavior = "smooth") => {
      if (!endRef.current) {
        return;
      }
      if (scrollAnimationFrameRef.current) {
        window.cancelAnimationFrame(scrollAnimationFrameRef.current);
      }
      markProgrammaticScroll(behavior === "smooth" ? 600 : 150);
      scrollAnimationFrameRef.current = window.requestAnimationFrame(() => {
        endRef.current?.scrollIntoView({ behavior });
        scrollAnimationFrameRef.current = null;
      });
    },
    [markProgrammaticScroll],
  );

  useEffect(() => {
    return () => {
      if (scrollAnimationFrameRef.current) {
        window.cancelAnimationFrame(scrollAnimationFrameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!autoScrollEnabled) {
      return;
    }
    scrollToBottom("smooth");
    const timeout = setTimeout(() => {
      scrollToBottom("smooth");
    }, 100);
    return () => clearTimeout(timeout);
  }, [autoScrollEnabled, chatEntryOrder, liveReasoningSegments, liveResponse, scrollToBottom]);

  useEffect(() => {
    setAutoScrollEnabled(true);
  }, [selectedSessionId]);

  useEffect(
    () => () => {
      if (programmaticScrollTimeoutRef.current) {
        window.clearTimeout(programmaticScrollTimeoutRef.current);
      }
    },
    [],
  );

  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) {
      return;
    }
    if (programmaticScrollRef.current) {
      return;
    }
    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    if (distanceFromBottom > 12) {
      if (autoScrollEnabled) {
        setAutoScrollEnabled(false);
      }
      return;
    }
    if (!autoScrollEnabled && distanceFromBottom <= 2) {
      setAutoScrollEnabled(true);
    }
  }, [autoScrollEnabled]);

  const handleReenableAutoScroll = useCallback(() => {
    setAutoScrollEnabled(true);
    scrollToBottom("smooth");
  }, [scrollToBottom]);

  return {
    autoScrollEnabled,
    setAutoScrollEnabled,
    endRef,
    messagesContainerRef,
    scrollAnimationFrameRef,
    scrollToBottom,
    markProgrammaticScroll,
    handleScroll,
    handleReenableAutoScroll,
  };
}
