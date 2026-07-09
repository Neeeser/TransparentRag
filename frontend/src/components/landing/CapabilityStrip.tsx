import { PIPELINE_STAGES } from "@/components/landing/lib/constants";

/**
 * The pipeline stages named in flow order, echoing the running backdrop above.
 * Each stage's dot uses the same color family it has in the pipeline editor,
 * tying the strip to the animation rather than decorating for its own sake.
 */
export function CapabilityStrip() {
  return (
    <ul className="flex flex-wrap items-center justify-center gap-x-1 gap-y-3 font-mono text-[11px] uppercase tracking-[0.28em] text-slate-400 sm:text-xs">
      {PIPELINE_STAGES.map((stage, index) => (
        <li key={stage.label} className="flex items-center">
          <span className="flex items-center gap-2">
            <span className={`h-1.5 w-1.5 rounded-full ${stage.dotClass}`} aria-hidden />
            {stage.label}
          </span>
          {index < PIPELINE_STAGES.length - 1 ? (
            <span className="mx-3 text-slate-700" aria-hidden>
              /
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
