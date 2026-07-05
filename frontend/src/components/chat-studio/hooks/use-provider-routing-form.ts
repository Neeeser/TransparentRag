"use client";

import { useCallback } from "react";

import type { ProviderFormState, ProviderSelectionField } from "@/components/chat-studio/types";

type SetProviderForm = (updater: (prev: ProviderFormState) => ProviderFormState) => void;

export interface UseProviderRoutingFormResult {
  toggleProviderField: (field: ProviderSelectionField, slug: string) => void;
  moveProviderOrderEntry: (slug: string, delta: number) => void;
  toggleQuantization: (value: string) => void;
}

/**
 * Field-mutation callbacks shared by ProviderRoutingCard's selection lists (order/only/ignore),
 * order reordering, and quantization filter toggles. Extracted out of the card component to
 * keep it under the house max-lines limit.
 */
export function useProviderRoutingForm(
  setProviderForm: SetProviderForm,
): UseProviderRoutingFormResult {
  const toggleProviderField = useCallback(
    (field: ProviderSelectionField, slug: string) => {
      setProviderForm((prev) => {
        const list = prev[field];
        const exists = list.includes(slug);
        const nextList = exists ? list.filter((entry) => entry !== slug) : [...list, slug];
        return { ...prev, [field]: nextList };
      });
    },
    [setProviderForm],
  );

  const moveProviderOrderEntry = useCallback(
    (slug: string, delta: number) => {
      setProviderForm((prev) => {
        const index = prev.order.indexOf(slug);
        if (index === -1) {
          return prev;
        }
        const target = index + delta;
        if (target < 0 || target >= prev.order.length) {
          return prev;
        }
        const nextOrder = [...prev.order];
        nextOrder.splice(index, 1);
        nextOrder.splice(target, 0, slug);
        return { ...prev, order: nextOrder };
      });
    },
    [setProviderForm],
  );

  const toggleQuantization = useCallback(
    (value: string) => {
      setProviderForm((prev) => {
        const exists = prev.quantizations.includes(value);
        const next = exists
          ? prev.quantizations.filter((entry) => entry !== value)
          : [...prev.quantizations, value];
        return { ...prev, quantizations: next };
      });
    },
    [setProviderForm],
  );

  return { toggleProviderField, moveProviderOrderEntry, toggleQuantization };
}
