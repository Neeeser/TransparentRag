"use client";

import type { ProviderFormState } from "@/components/chat-studio/lib/types";

type ProviderMaxPriceSectionProps = {
  providerForm: ProviderFormState;
  setProviderForm: (updater: (prev: ProviderFormState) => ProviderFormState) => void;
  inputClasses: string;
};

const PRICE_FIELDS = [
  { key: "maxPrompt", label: "Prompt", placeholder: "1.00" },
  { key: "maxCompletion", label: "Completion", placeholder: "2.00" },
  { key: "maxRequest", label: "Request", placeholder: "0.25" },
  { key: "maxImage", label: "Image", placeholder: "0.02" },
] as const;

/** Per-turn price caps (prompt/completion/request/image). Split out of
 *  ProviderRoutingCard to keep that file under the module-size limit. */
export const ProviderMaxPriceSection = ({
  providerForm,
  setProviderForm,
  inputClasses,
}: ProviderMaxPriceSectionProps) => (
  <div className="space-y-3 rounded-2xl border border-hairline bg-surface p-4">
    <div className="space-y-1">
      <p className="font-mono text-xs uppercase tracking-[0.35em] text-meta">
        Max price ($/m tokens)
      </p>
      <p className="text-sm text-body">
        Cap prompt, completion, request, or image pricing for this turn.
      </p>
    </div>
    <div className="grid grid-cols-2 gap-3">
      {PRICE_FIELDS.map((field) => (
        <label key={field.key} className="space-y-1 text-sm text-body">
          <span className="font-mono text-xs uppercase tracking-[0.3em] text-meta">
            {field.label}
          </span>
          <input
            type="number"
            min="0"
            step="0.0001"
            className={inputClasses}
            placeholder={field.placeholder}
            value={providerForm[field.key]}
            onChange={(event) =>
              setProviderForm((prev) => ({ ...prev, [field.key]: event.target.value }))
            }
          />
        </label>
      ))}
    </div>
  </div>
);
