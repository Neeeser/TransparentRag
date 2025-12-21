'use client';

import { FilePlus, FolderKanban, Search, UploadCloud } from 'lucide-react';
import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Loader } from '@/components/ui/loader';
import { GlassCard } from '@/components/ui/panel';
import {
  createCollection,
  fetchCollections,
  fetchDocumentChunks,
  fetchDocuments,
  runCollectionQuery,
  uploadDocument,
} from '@/lib/api';
import { cn, truncate } from '@/lib/utils';
import { useAuth } from '@/providers/auth-provider';

import type { Chunk, Collection, CollectionQueryResult, Document } from '@/lib/types';

const chunkStrategies = ['token', 'sentence', 'paragraph', 'semantic'] as const;

export default function CollectionsPage() {
  const { token } = useAuth();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedCollection, setSelectedCollection] = useState<Collection | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [chunkView, setChunkView] = useState<Chunk[]>([]);
  const [queryResult, setQueryResult] = useState<CollectionQueryResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState<{
    name: string;
    description: string;
    chunk_size: number;
    chunk_overlap: number;
    chunk_strategy: (typeof chunkStrategies)[number];
  }>({
    name: '',
    description: '',
    chunk_size: 1024,
    chunk_overlap: 200,
    chunk_strategy: 'token',
  });
  const [query, setQuery] = useState('What does TransparentRAG do?');
  const [topK, setTopK] = useState(4);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const authToken = token ?? '';
    if (!authToken) return;
    let cancelled = false;

    async function loadCollections() {
      setLoading(true);
      try {
        const data = await fetchCollections(authToken);
        if (cancelled) return;
        setCollections(data);
        if (data.length > 0) {
          setSelectedCollection(data[0]);
        }
      } catch (err) {
        if (!cancelled) {
          setMessage(err instanceof Error ? err.message : 'Unable to load collections.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadCollections();
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    const authToken = token ?? '';
    const collection = selectedCollection;
    if (!authToken || !collection) {
      setDocuments([]);
      setSelectedDocument(null);
      setChunkView([]);
      return;
    }
    let cancelled = false;
    async function loadDocuments(currentToken: string, collectionId: string) {
      setWorking(true);
      try {
        const docs = await fetchDocuments(collectionId, currentToken);
        if (!cancelled) {
          setDocuments(docs);
          if (docs.length > 0) {
            setSelectedDocument(docs[0]);
          } else {
            setSelectedDocument(null);
            setChunkView([]);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setMessage(err instanceof Error ? err.message : 'Unable to load documents.');
        }
      } finally {
        if (!cancelled) setWorking(false);
      }
    }
    loadDocuments(authToken, collection.id);
    return () => {
      cancelled = true;
    };
  }, [selectedCollection, token]);

  useEffect(() => {
    const authToken = token ?? '';
    const document = selectedDocument;
    if (!authToken || !document) {
      setChunkView([]);
      return;
    }
    let cancelled = false;
    async function loadChunks(currentToken: string, documentId: string) {
      try {
        const { chunks } = await fetchDocumentChunks(documentId, currentToken);
        if (!cancelled) {
          setChunkView(chunks);
        }
      } catch (err) {
        if (!cancelled) {
          setMessage(err instanceof Error ? err.message : 'Unable to load chunks.');
        }
      }
    }
    loadChunks(authToken, document.id);
    return () => {
      cancelled = true;
    };
  }, [selectedDocument, token]);

  const handleCreateCollection = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const authToken = token ?? '';
    if (!authToken) return;
    setCreating(true);
    setMessage(null);
    try {
      const payload = {
        name: form.name,
        description: form.description,
        chunk_settings: {
          chunk_size: form.chunk_size,
          chunk_overlap: form.chunk_overlap,
          strategy: form.chunk_strategy,
        },
      };
      const newCollection = await createCollection(authToken, payload);
      setCollections((prev) => [newCollection, ...prev]);
      setSelectedCollection(newCollection);
      setForm({
        name: '',
        description: '',
        chunk_size: 1024,
        chunk_overlap: 200,
        chunk_strategy: 'token',
      });
      setMessage('Collection created. Configure documents below.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to create collection.');
    } finally {
      setCreating(false);
    }
  };

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const authToken = token ?? '';
    const collection = selectedCollection;
    if (!authToken || !collection) return;
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setMessage(null);
    try {
      await uploadDocument(collection.id, file, authToken);
      const docs = await fetchDocuments(collection.id, authToken);
      setDocuments(docs);
      if (docs.length > 0) {
        setSelectedDocument(docs[0]);
      }
      setMessage(`Uploaded ${file.name}. Chunking in progress.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Upload failed.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleQuery = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const authToken = token ?? '';
    const collection = selectedCollection;
    if (!authToken || !collection || !query.trim()) return;
    setWorking(true);
    setMessage(null);
    try {
      const result = await runCollectionQuery(collection.id, { query, top_k: topK }, authToken);
      setQueryResult(result);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Query failed.');
    } finally {
      setWorking(false);
    }
  };

  const topScores = useMemo(() => {
    if (!queryResult?.chunks?.length) return { max: 0 };
    const max = Math.max(...queryResult.chunks.map((chunk) => chunk.score ?? 0));
    return { max };
  }, [queryResult]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm uppercase tracking-[0.35em] text-slate-400">Collections</p>
        <h1 className="text-3xl font-semibold text-white">Manage knowledge bases & retrieval.</h1>
      </div>

      {message && (
        <GlassCard className="rounded-3xl border border-white/10 p-4 text-sm text-slate-200">
          {message}
        </GlassCard>
      )}

      {loading ? (
        <GlassCard className="flex items-center justify-center rounded-3xl p-10">
          <Loader className="h-6 w-6" />
        </GlassCard>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-6">
            <GlassCard className="rounded-3xl p-6">
              <div className="flex items-center gap-3">
                <FolderKanban className="h-5 w-5 text-violet-300" />
                <h2 className="text-xl font-semibold">Your collections</h2>
              </div>
              <div className="mt-4 space-y-3">
                {collections.length === 0 && (
                  <p className="text-sm text-slate-400">
                    No collections yet. Create one with chunk parameters below.
                  </p>
                )}
                {collections.map((collection) => {
                  const isActive = selectedCollection?.id === collection.id;
                  return (
                    <button
                      type="button"
                      key={collection.id}
                      className={cn(
                        'w-full rounded-2xl border px-4 py-3 text-left text-sm transition',
                        isActive
                          ? 'border-violet-400 bg-violet-500/10 text-white'
                          : 'border-white/5 bg-white/5 text-slate-300 hover:border-white/20',
                      )}
                      onClick={() => setSelectedCollection(collection)}
                    >
                      <p className="text-base font-semibold">{collection.name}</p>
                      <p className="text-xs text-slate-400">{collection.description}</p>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-300">
                        <span className="rounded-full bg-white/10 px-2 py-1">
                          {collection.chunk_settings.strategy} strategy
                        </span>
                        <span className="rounded-full bg-white/10 px-2 py-1">
                          chunk {collection.chunk_settings.chunk_size}
                        </span>
                        <span className="rounded-full bg-white/10 px-2 py-1">
                          overlap {collection.chunk_settings.chunk_overlap}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </GlassCard>

            <GlassCard className="rounded-3xl p-6">
              <div className="flex items-center gap-3">
                <FilePlus className="h-5 w-5 text-cyan-300" />
                <h2 className="text-xl font-semibold">Provision collection</h2>
              </div>

              <form className="mt-6 space-y-4" onSubmit={handleCreateCollection}>
                <input
                  type="text"
                  placeholder="Name"
                  required
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-violet-400"
                  value={form.name}
                  onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                />
                <textarea
                  placeholder="Description"
                  className="h-20 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-violet-400"
                  value={form.description}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, description: event.target.value }))
                  }
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="text-xs uppercase tracking-[0.3em] text-slate-400">
                      Chunk size
                    </label>
                    <input
                      type="number"
                      min={128}
                      className="mt-1 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-violet-400"
                      value={form.chunk_size}
                      onChange={(event) =>
                        setForm((prev) => ({ ...prev, chunk_size: Number(event.target.value) }))
                      }
                    />
                  </div>
                  <div>
                    <label className="text-xs uppercase tracking-[0.3em] text-slate-400">
                      Overlap
                    </label>
                    <input
                      type="number"
                      min={0}
                      className="mt-1 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-violet-400"
                      value={form.chunk_overlap}
                      onChange={(event) =>
                        setForm((prev) => ({ ...prev, chunk_overlap: Number(event.target.value) }))
                      }
                    />
                  </div>
                </div>
                <select
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-violet-400"
                  value={form.chunk_strategy}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      chunk_strategy: event.target.value as (typeof chunkStrategies)[number],
                    }))
                  }
                >
                  {chunkStrategies.map((strategy) => (
                    <option key={strategy} value={strategy}>
                      {strategy} strategy
                    </option>
                  ))}
                </select>
                <Button type="submit" loading={creating} className="w-full">
                  Create collection
                </Button>
              </form>
            </GlassCard>
          </div>

          <div className="space-y-6">
            {selectedCollection ? (
              <>
                <GlassCard className="rounded-3xl p-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm uppercase tracking-[0.35em] text-slate-400">Overview</p>
                      <h2 className="text-2xl font-semibold">{selectedCollection.name}</h2>
                      <p className="text-sm text-slate-400">{selectedCollection.description}</p>
                    </div>
                    <Button
                      variant="secondary"
                      onClick={() => fileInputRef.current?.click()}
                      loading={uploading}
                      className="flex items-center gap-2"
                    >
                      <UploadCloud className="h-4 w-4" />
                      Upload document
                    </Button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      onChange={handleUpload}
                    />
                  </div>
                  <dl className="mt-6 grid gap-4 sm:grid-cols-3">
                    {[
                      { label: 'Embedding model', value: selectedCollection.embedding_model },
                      { label: 'Chat model', value: selectedCollection.chat_model },
                      {
                        label: 'Pinecone namespace',
                        value: selectedCollection.pinecone_namespace,
                      },
                    ].map((item) => (
                      <div key={item.label} className="rounded-2xl border border-white/5 bg-white/5 p-4">
                        <dt className="text-xs uppercase tracking-[0.3em] text-slate-400">
                          {item.label}
                        </dt>
                        <dd className="mt-2 text-sm text-white break-all">{item.value}</dd>
                      </div>
                    ))}
                  </dl>
                </GlassCard>

                <GlassCard className="rounded-3xl p-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm uppercase tracking-[0.35em] text-slate-400">Retriever</p>
                      <h2 className="text-2xl font-semibold">Transparent similarity search</h2>
                    </div>
                    <Search className="h-5 w-5 text-violet-300" />
                  </div>
                  <form className="mt-4 space-y-4" onSubmit={handleQuery}>
                    <textarea
                      className="min-h-[120px] w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-violet-400"
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                    />
                    <div className="flex flex-wrap items-center gap-3 text-sm text-slate-300">
                      <label htmlFor="topk" className="text-xs uppercase tracking-[0.3em]">
                        Top K
                      </label>
                      <input
                        id="topk"
                        type="number"
                        min={1}
                        max={12}
                        value={topK}
                        onChange={(event) => setTopK(Number(event.target.value))}
                        className="w-20 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-center text-white outline-none focus:border-violet-400"
                      />
                      <Button type="submit" loading={working}>
                        Run query
                      </Button>
                    </div>
                  </form>

                  <div className="mt-6 space-y-4">
                    {!queryResult && <p className="text-sm text-slate-400">No queries yet.</p>}
                    {queryResult?.chunks?.map((chunk) => (
                      <div
                        key={`${chunk.id}-${chunk.chunk_index}-${chunk.score}`}
                        className="rounded-2xl border border-white/5 p-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                            score {(chunk.score ?? 0).toFixed(3)}
                          </p>
                          <div className="h-2 w-32 rounded-full bg-white/5">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400"
                              style={{
                                width: `${topScores.max ? ((chunk.score ?? 0) / topScores.max) * 100 : 0}%`,
                              }}
                            />
                          </div>
                        </div>
                        <p className="mt-3 text-sm text-slate-100">
                          {truncate(chunk.text ?? '', 320)}
                        </p>
                        {chunk.metadata && (
                          <p className="mt-2 text-xs text-slate-400">
                            {Object.entries(chunk.metadata)
                              .slice(0, 3)
                              .map(([key, value]) => `${key}: ${value}`)
                              .join(' • ')}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </GlassCard>

                <GlassCard className="rounded-3xl p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm uppercase tracking-[0.35em] text-slate-400">Documents</p>
                      <h2 className="text-2xl font-semibold">Sources & chunks</h2>
                    </div>
                    <span className="text-sm text-slate-400">{documents.length} total</span>
                  </div>
                  <div className="mt-5 grid gap-4 lg:grid-cols-2">
                    {documents.length === 0 ? (
                      <p className="text-sm text-slate-400">
                        Upload documents to visualize chunk lineage.
                      </p>
                    ) : (
                      documents.map((doc) => {
                        const isActive = selectedDocument?.id === doc.id;
                        return (
                          <button
                            type="button"
                            key={doc.id}
                            className={cn(
                              'rounded-2xl border px-4 py-4 text-left text-sm transition',
                              isActive
                                ? 'border-violet-400 bg-violet-500/10 text-white'
                                : 'border-white/5 bg-white/5 text-slate-300 hover:border-white/20',
                            )}
                            onClick={() => setSelectedDocument(doc)}
                          >
                            <p className="text-base font-semibold">{doc.name}</p>
                            <p className="text-xs text-slate-400">
                              {doc.status.toUpperCase()} • {doc.num_chunks} chunks
                            </p>
                          </button>
                        );
                      })
                    )}
                  </div>

                  {selectedDocument && (
                    <div className="mt-6 rounded-2xl border border-white/5 bg-white/5 p-4">
                      <p className="text-sm uppercase tracking-[0.3em] text-slate-400">
                        {selectedDocument.name}
                      </p>
                      <p className="text-xs text-slate-400">
                        Strategy {selectedDocument.chunk_strategy} • overlap {selectedDocument.chunk_overlap}
                      </p>
                      <div className="mt-4 max-h-72 space-y-3 overflow-y-auto pr-2">
                        {chunkView.length === 0 ? (
                          <p className="text-sm text-slate-400">No chunks ready yet.</p>
                        ) : (
                          chunkView.map((chunk) => (
                            <div key={chunk.id} className="rounded-xl bg-black/20 p-3">
                              <p className="text-xs text-slate-400">#{chunk.chunk_index}</p>
                              <p className="text-sm text-slate-100">{truncate(chunk.text, 200)}</p>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </GlassCard>
              </>
            ) : (
              <GlassCard className="flex h-full flex-col items-center justify-center rounded-3xl p-10 text-center text-slate-400">
                <p>Select or create a collection to begin configuring retrieval.</p>
              </GlassCard>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
