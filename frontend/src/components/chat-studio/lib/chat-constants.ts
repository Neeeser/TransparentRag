"use client";

import type { RunSettingsSectionKey } from "@/lib/types";

/** Shared small-uppercase pill styling used for chip-like badges across chat-studio
 * (history filters, collection tool chips, system-prompt section chips). */
export const chipClass =
  "rounded-full border border-hairline bg-surface px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.25em] text-muted";

export const CHAT_INPUT_MIN_HEIGHT = 40;
export const CHAT_INPUT_MAX_HEIGHT = 160;
export const DEFAULT_STREAMING_ENABLED = true;

export const TELEMETRY_SECTION_IDS = {
  systemPrompt: "telemetry-system-prompt",
  collectionTools: "telemetry-collection-tools",
  streaming: "telemetry-streaming",
  modelRouting: "telemetry-model-routing",
  providerRouting: "telemetry-provider-routing",
  modelParameters: "telemetry-model-parameters",
  vitals: "telemetry-collection-vitals",
  usage: "telemetry-usage",
} as const;

export const DEFAULT_TELEMETRY_ORDER: RunSettingsSectionKey[] = [
  "systemPrompt",
  "collectionTools",
  "streaming",
  "modelRouting",
  "providerRouting",
  "vitals",
  "modelParameters",
  "usage",
];
