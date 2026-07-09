interface BranchedFromBannerProps {
  className: string;
  branchedFromSessionId: string | null;
  branchedFromLabel: string;
  onNavigateToSession: (sessionId: string) => void;
}

export const BranchedFromBanner = ({
  className,
  branchedFromSessionId,
  branchedFromLabel,
  onNavigateToSession,
}: BranchedFromBannerProps) => (
  <div className={className}>
    <span className="font-mono text-[9px] uppercase tracking-[0.35em] text-meta">
      Branched from
    </span>
    {branchedFromSessionId ? (
      <button
        type="button"
        onClick={() => onNavigateToSession(branchedFromSessionId)}
        className="text-body underline-offset-4 hover:underline"
      >
        {branchedFromLabel}
      </button>
    ) : (
      <span>{branchedFromLabel}</span>
    )}
  </div>
);
