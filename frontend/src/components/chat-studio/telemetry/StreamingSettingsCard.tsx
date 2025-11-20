'use client';

interface StreamingSettingsCardProps {
  streamingEnabled: boolean;
  onToggle: (enabled: boolean) => void;
}

export const StreamingSettingsCard = ({ streamingEnabled, onToggle }: StreamingSettingsCardProps) => {
  return (
    <div className="space-y-2 rounded-2xl border border-white/10 bg-black/20 p-3 text-sm text-slate-300">
      <label className="flex items-center justify-between gap-3 text-sm text-slate-200">
        <span className="font-medium text-white">Enable streaming</span>
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-white/30 bg-transparent"
          checked={streamingEnabled}
          onChange={(event) => onToggle(event.target.checked)}
        />
      </label>
      <p className="text-xs text-slate-400">
        Stream OpenRouter completions to this console via Server-Sent Events for real-time feedback.
      </p>
    </div>
  );
};
