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
        <ShieldCheck className="h-5 w-5 text-emerald-300" />
        <h2 className="text-xl font-semibold text-white">Status</h2>
      </div>
      <div className="mt-4 space-y-4 text-sm text-slate-300">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">OpenRouter</p>
          <p className="mt-2 text-sm text-white">{openrouterStatusText}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Pinecone</p>
          <p className="mt-2 text-sm text-white">{pineconeStatusText}</p>
        </div>
      </div>
    </>
  );
}
