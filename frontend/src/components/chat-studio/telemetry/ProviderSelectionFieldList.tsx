"use client";

import { ArrowDown, ArrowUp } from "lucide-react";

interface ProviderSelectionFieldListProps {
  label: string;
  fieldKey: string;
  values: string[];
  showIndex?: boolean;
  allowReorder?: boolean;
  onRemove: (slug: string) => void;
  onMove: (slug: string, delta: number) => void;
}

export const ProviderSelectionFieldList = ({
  label,
  fieldKey,
  values,
  showIndex,
  allowReorder,
  onRemove,
  onMove,
}: ProviderSelectionFieldListProps) => {
  return (
    <div className="space-y-2" key={fieldKey}>
      <div className="flex items-center justify-between text-xs uppercase tracking-[0.3em] text-slate-500">
        <span>{label}</span>
        {values.length === 0 && <span className="text-[10px] text-slate-500">None selected</span>}
      </div>
      {values.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {values.map((slug, index) => (
            <div
              key={`${fieldKey}-${slug}`}
              className="flex items-center gap-1 rounded-full border border-white/10 bg-black/40 px-3 py-1.5 text-xs text-white"
            >
              {showIndex && <span className="text-[10px] text-slate-400">#{index + 1}</span>}
              <span className="font-mono text-[11px]">{slug}</span>
              {allowReorder && values.length > 1 && (
                <div className="flex items-center gap-1 text-slate-400">
                  <button
                    type="button"
                    className="hover:text-white disabled:opacity-30"
                    onClick={() => onMove(slug, -1)}
                    disabled={index === 0}
                    aria-label={`Move ${slug} earlier`}
                  >
                    <ArrowUp className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    className="hover:text-white disabled:opacity-30"
                    onClick={() => onMove(slug, 1)}
                    disabled={index === values.length - 1}
                    aria-label={`Move ${slug} later`}
                  >
                    <ArrowDown className="h-3 w-3" />
                  </button>
                </div>
              )}
              <button
                type="button"
                className="text-slate-300 hover:text-white"
                onClick={() => onRemove(slug)}
                aria-label={`Remove ${slug}`}
              >
                &times;
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
