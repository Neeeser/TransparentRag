import { makeToolId } from "@/components/chat-studio/chat-helpers";
import { normalizeReasoningSegments } from "@/components/chat-studio/chat-utils";

import type { ReasoningTraceSegment, ToolCallTrace } from "@/lib/types";

/** Shape of an incremental tool-call/result update fed into the live tool list. */
export interface LiveToolUpsert {
  id?: string;
  name?: string;
  arguments?: Record<string, unknown>;
  response?: Record<string, unknown>;
  reasoning?: unknown;
  collection_id?: string;
  collection_name?: string;
}

/**
 * All live-stream UI state, owned by a single reducer so the many token / reasoning /
 * tool-event mutations share one predictable transition table instead of ~16 scattered
 * `useState` setters plus three copy-pasted reset blocks.
 */
export interface ChatStreamState {
  liveResponse: string;
  isStreamingResponse: boolean;
  liveReasoningSegments: ReasoningTraceSegment[];
  liveReasoningBlocks: ReasoningTraceSegment[][];
  liveReasoningPhase: number;
  persistedLiveReasoningSegments: ReasoningTraceSegment[];
  activeStreamEntryKey: string | null;
  finalStreamAssistantId: string | null;
  streamEntryKeyMap: Record<string, string>;
  liveToolEvents: ToolCallTrace[];
  liveToolOrder: string[];
  liveToolPhaseById: Record<string, number>;
  liveResponseAnimationKey: number;
  liveReasoningAnimationKey: number;
}

export const initialChatStreamState: ChatStreamState = {
  liveResponse: "",
  isStreamingResponse: false,
  liveReasoningSegments: [],
  liveReasoningBlocks: [],
  liveReasoningPhase: 0,
  persistedLiveReasoningSegments: [],
  activeStreamEntryKey: null,
  finalStreamAssistantId: null,
  streamEntryKeyMap: {},
  liveToolEvents: [],
  liveToolOrder: [],
  liveToolPhaseById: {},
  liveResponseAnimationKey: 0,
  liveReasoningAnimationKey: 0,
};

export type ChatStreamAction =
  /** Single reset path shared by branch-for-edit and start-new-chat. */
  | { type: "RESET" }
  /** Lighter reset used right before dispatching a send (mutation start refines it). */
  | { type: "RESET_LIVE_MESSAGE" }
  /** Clears per-turn live state at the start of a chat mutation (keeps stream-key map). */
  | { type: "MUTATION_STARTED" }
  | { type: "STREAM_STARTED"; streamKey: string }
  | { type: "TOKEN"; token: string }
  | { type: "REASONING_SET"; segments: ReasoningTraceSegment[] }
  | { type: "FINALIZE_REASONING_BLOCK"; phaseIndex: number; segments: ReasoningTraceSegment[] }
  | { type: "TOOL_CALL"; toolId: string; phaseIndex: number; update: LiveToolUpsert }
  | { type: "TOOL_RESULT"; toolId: string; fallbackPhase: number; update: LiveToolUpsert }
  | {
      type: "STREAM_FINISHED";
      finalAssistantId: string | null;
      streamKey: string | null;
      streamedReasoningSegments: ReasoningTraceSegment[];
    }
  | { type: "STREAM_FAILED"; clearLive: boolean }
  | { type: "STREAM_KEYS_RESET" }
  | { type: "PRUNE_LIVE_TOOLS"; persistedToolIds: Set<string> };

/** Pure upsert into the live tool-event list, merging incremental fields onto any existing entry. */
export function upsertLiveToolEvents(
  events: ToolCallTrace[],
  update: LiveToolUpsert,
): ToolCallTrace[] {
  const eventId = update.id || makeToolId();
  const reasoningSegments =
    update.reasoning !== undefined ? normalizeReasoningSegments(update.reasoning) : undefined;
  const next = [...events];
  const existingIndex = next.findIndex((item) => item.id === eventId);
  const base =
    existingIndex >= 0
      ? next[existingIndex]
      : {
          id: eventId,
          name: update.name || "tool_call",
          arguments: {},
          response: {},
          reasoning: null as ToolCallTrace["reasoning"],
          collection_id: update.collection_id ?? null,
          collection_name: update.collection_name ?? null,
        };
  const merged = {
    ...base,
    name: update.name || base.name,
    arguments: { ...base.arguments, ...(update.arguments || {}) },
    response: update.response !== undefined ? update.response || {} : base.response || {},
    collection_id: update.collection_id ?? base.collection_id ?? null,
    collection_name: update.collection_name ?? base.collection_name ?? null,
    reasoning:
      reasoningSegments && reasoningSegments.length > 0
        ? { segments: reasoningSegments }
        : (base.reasoning ?? null),
  };
  if (existingIndex >= 0) {
    next[existingIndex] = merged;
    return next;
  }
  return [...next, merged];
}

export function chatStreamReducer(
  state: ChatStreamState,
  action: ChatStreamAction,
): ChatStreamState {
  switch (action.type) {
    case "RESET":
      return {
        ...state,
        liveResponse: "",
        isStreamingResponse: false,
        finalStreamAssistantId: null,
        streamEntryKeyMap: {},
        activeStreamEntryKey: null,
        liveReasoningSegments: [],
        liveReasoningBlocks: [],
        liveReasoningPhase: 0,
        persistedLiveReasoningSegments: [],
      };
    case "RESET_LIVE_MESSAGE":
      return {
        ...state,
        liveResponse: "",
        isStreamingResponse: false,
        liveReasoningSegments: [],
        liveReasoningBlocks: [],
        liveReasoningPhase: 0,
        persistedLiveReasoningSegments: [],
      };
    case "MUTATION_STARTED":
      return {
        ...state,
        liveResponse: "",
        isStreamingResponse: false,
        finalStreamAssistantId: null,
        liveToolEvents: [],
        liveToolOrder: [],
        liveToolPhaseById: {},
        liveReasoningSegments: [],
        liveReasoningBlocks: [],
        liveReasoningPhase: 0,
        persistedLiveReasoningSegments: [],
      };
    case "STREAM_STARTED":
      return {
        ...state,
        isStreamingResponse: true,
        activeStreamEntryKey: action.streamKey,
      };
    case "TOKEN": {
      if (!action.token) {
        return state;
      }
      const hadText = state.liveResponse.trim().length > 0;
      const liveResponse = `${state.liveResponse}${action.token}`;
      const hasText = liveResponse.trim().length > 0;
      return {
        ...state,
        liveResponse,
        liveResponseAnimationKey:
          hasText && !hadText ? state.liveResponseAnimationKey + 1 : state.liveResponseAnimationKey,
      };
    }
    case "REASONING_SET": {
      const segments = action.segments;
      const hadSegments = state.liveReasoningSegments.length > 0;
      const hasSegments = segments.length > 0;
      return {
        ...state,
        liveReasoningSegments: segments,
        persistedLiveReasoningSegments: hasSegments
          ? segments
          : state.persistedLiveReasoningSegments,
        liveReasoningAnimationKey:
          hasSegments && !hadSegments
            ? state.liveReasoningAnimationKey + 1
            : state.liveReasoningAnimationKey,
      };
    }
    case "FINALIZE_REASONING_BLOCK": {
      const nextBlocks = [...state.liveReasoningBlocks];
      nextBlocks[action.phaseIndex] = action.segments;
      return {
        ...state,
        liveReasoningBlocks: nextBlocks,
        liveReasoningSegments: [],
        persistedLiveReasoningSegments: [],
      };
    }
    case "TOOL_CALL": {
      const { toolId, phaseIndex, update } = action;
      return {
        ...state,
        liveToolPhaseById:
          state.liveToolPhaseById[toolId] === phaseIndex
            ? state.liveToolPhaseById
            : { ...state.liveToolPhaseById, [toolId]: phaseIndex },
        liveToolOrder: state.liveToolOrder.includes(toolId)
          ? state.liveToolOrder
          : [...state.liveToolOrder, toolId],
        liveReasoningPhase: phaseIndex + 1,
        liveToolEvents: upsertLiveToolEvents(state.liveToolEvents, update),
      };
    }
    case "TOOL_RESULT": {
      const { toolId, fallbackPhase, update } = action;
      return {
        ...state,
        liveToolOrder: state.liveToolOrder.includes(toolId)
          ? state.liveToolOrder
          : [...state.liveToolOrder, toolId],
        liveToolPhaseById:
          state.liveToolPhaseById[toolId] !== undefined
            ? state.liveToolPhaseById
            : { ...state.liveToolPhaseById, [toolId]: fallbackPhase },
        liveToolEvents: upsertLiveToolEvents(state.liveToolEvents, update),
      };
    }
    case "STREAM_FINISHED": {
      const streamEntryKeyMap =
        action.finalAssistantId && action.streamKey
          ? { ...state.streamEntryKeyMap, [action.finalAssistantId]: action.streamKey }
          : state.streamEntryKeyMap;
      return {
        ...state,
        liveResponse: "",
        isStreamingResponse: false,
        persistedLiveReasoningSegments: action.streamedReasoningSegments,
        liveReasoningSegments: [],
        liveReasoningBlocks: [],
        finalStreamAssistantId: action.finalAssistantId,
        streamEntryKeyMap,
      };
    }
    case "STREAM_FAILED":
      return {
        ...state,
        isStreamingResponse: false,
        liveResponse: action.clearLive ? "" : state.liveResponse,
        liveReasoningSegments: action.clearLive ? [] : state.liveReasoningSegments,
        liveReasoningBlocks: action.clearLive ? [] : state.liveReasoningBlocks,
        liveReasoningPhase: action.clearLive ? 0 : state.liveReasoningPhase,
        persistedLiveReasoningSegments: action.clearLive
          ? []
          : state.persistedLiveReasoningSegments,
      };
    case "STREAM_KEYS_RESET":
      return {
        ...state,
        streamEntryKeyMap: {},
        activeStreamEntryKey: null,
      };
    case "PRUNE_LIVE_TOOLS": {
      if (state.liveToolEvents.length === 0 || action.persistedToolIds.size === 0) {
        return state;
      }
      const next = state.liveToolEvents.filter(
        (event) => !event.id || !action.persistedToolIds.has(event.id),
      );
      return next.length === state.liveToolEvents.length
        ? state
        : { ...state, liveToolEvents: next };
    }
    default:
      return state;
  }
}
