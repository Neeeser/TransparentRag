import { ShieldCheck } from "lucide-react";

type ApiKeyStatusPanelProps = {
  openrouterStatusText: string;
  pineconeStatusText: string;
};

/** Read-only summary of each provider's live validation status. */
export function ApiKeyStatusPanel({
  openrouterStatusText,
  pineconeStatusText,
}: ApiKeyStatusPanelProps) {
  return (
    <>
      <div className="flex items-center gap-3">
        <ShieldCheck className="h-5 w-5 text-accent-cyan" />
        <h2 className="text-xl font-semibold text-primary">Status</h2>
      </div>
      <div className="mt-4 space-y-4">
        <div className="rounded-2xl border border-hairline bg-surface p-4">
          <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-muted">OpenRouter</p>
          <p className="mt-2 text-sm text-body">{openrouterStatusText}</p>
        </div>
        <div className="rounded-2xl border border-hairline bg-surface p-4">
          <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-muted">Pinecone</p>
          <p className="mt-2 text-sm text-body">{pineconeStatusText}</p>
        </div>
      </div>
    </>
  );
}
