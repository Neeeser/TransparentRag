'use client';

import type { Collection } from '@/lib/types';

interface CollectionVitalsCardProps {
  collection: Collection | null;
  documentCount: number;
}

export const CollectionVitalsCard = ({ collection, documentCount }: CollectionVitalsCardProps) => {
  if (!collection) {
    return <p className="text-sm text-slate-400">Loading collection details…</p>;
  }

  return (
    <div className="space-y-2 text-sm text-slate-300">
      <p>
        Documents: <span className="text-white">{documentCount}</span>
      </p>
      <p>
        Embeddings: <span className="text-white">{collection.embedding_model}</span>
      </p>
      <p>
        Chat model: <span className="text-white">{collection.chat_model}</span>
      </p>
      <p>
        Chunking:{' '}
        <span className="text-white">
          {collection.chunk_settings.strategy} • {collection.chunk_settings.chunk_size}/
          {collection.chunk_settings.chunk_overlap}
        </span>
      </p>
      <p>
        Context window:{' '}
        <span className="text-white">
          {collection.context_window.toLocaleString()} tokens
        </span>
      </p>
    </div>
  );
};
