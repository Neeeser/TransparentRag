interface EmptyTimelineStateProps {
  modelLabel: string;
  onModelSelect: () => void;
  overrideSections: Array<{ id: string; label: string }>;
  onOverrideSelect: (sectionId: string) => void;
}

export const EmptyTimelineState = ({
  modelLabel,
  onModelSelect,
  overrideSections,
  onOverrideSelect,
}: EmptyTimelineStateProps) => (
  <div className="flex h-full flex-col items-center justify-center gap-10 text-center">
    <div className="flex w-full max-w-md flex-col items-center">
      <button
        type="button"
        onClick={onModelSelect}
        className="flex w-full min-w-0 items-center gap-3 rounded-2xl border border-hairline bg-surface px-5 py-3 text-left text-xs text-body transition hover:border-strong hover:text-primary"
      >
        <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.35em] text-meta">
          Model
        </span>
        <span className="min-w-0 truncate text-sm font-semibold text-primary">{modelLabel}</span>
      </button>
    </div>
    <div className="w-full max-w-3xl rounded-3xl border border-hairline bg-surface p-6 text-left shadow-elevation-2">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <p className="font-mono text-xs uppercase tracking-[0.35em] text-meta">Overrides</p>
          <h4 className="text-lg font-semibold text-primary">Run settings active</h4>
          <p className="text-sm text-muted">Tap a section to open it in Run settings.</p>
        </div>
        <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.4em] text-accent-cyan">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-cyan opacity-60 motion-reduce:animate-none" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-accent-cyan" />
          </span>
          Live
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {overrideSections.length > 0 ? (
          overrideSections.map((section) => (
            <button
              key={section.id}
              type="button"
              onClick={() => onOverrideSelect(section.id)}
              className="rounded-full border border-accent-cyan/30 bg-accent-cyan/10 px-4 py-1.5 font-mono text-xs font-semibold uppercase tracking-[0.2em] text-accent-cyan transition hover:border-accent-cyan/60 hover:bg-accent-cyan/20"
            >
              {section.label}
            </button>
          ))
        ) : (
          <span className="font-mono text-xs uppercase tracking-[0.3em] text-meta">
            No overrides yet
          </span>
        )}
      </div>
    </div>
  </div>
);
