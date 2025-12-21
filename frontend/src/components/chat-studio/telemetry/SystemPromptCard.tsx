'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';


import { Button } from '@/components/ui/button';

import type { CollectionPromptDetails } from '@/lib/types';
import type { Components } from 'react-markdown';

interface SystemPromptCardProps {
  promptDetails: CollectionPromptDetails | null;
  promptLoading: boolean;
  promptError: string | null;
  onEdit: () => void;
  markdownComponents: Components;
}

export const SystemPromptCard = ({
  promptDetails,
  promptLoading,
  promptError,
  onEdit,
  markdownComponents,
}: SystemPromptCardProps) => {
  if (promptLoading) {
    return <p className="text-sm text-slate-400">Loading prompt…</p>;
  }

  if (promptError) {
    return (
      <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-100">
        {promptError}
      </div>
    );
  }

  if (!promptDetails) {
    return <p className="text-sm text-slate-400">Prompt details unavailable.</p>;
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-400">
        Prompt renders with collection metadata and user context. Click any variable in the
        editor to inject placeholders like{' '}
        <code className="rounded bg-white/10 px-1 text-[11px] text-violet-200">
          {'{{collection.name}}'}
        </code>
        .
      </p>
      <div className="max-h-48 overflow-y-auto rounded-2xl border border-white/10 bg-black/40 p-4 text-sm">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
          {promptDetails.rendered}
        </ReactMarkdown>
      </div>
      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
        <span>
          Generated for{' '}
          <strong className="text-white">{promptDetails.context?.['datetime.iso']}</strong>
        </span>
        <span className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] uppercase tracking-[0.25em] text-slate-300">
          {promptDetails.is_custom ? 'Custom template' : 'Default'}
        </span>
        <Button
          variant="secondary"
          size="sm"
          className="ml-auto"
          onClick={onEdit}
        >
          Edit prompt
        </Button>
      </div>
    </div>
  );
};
