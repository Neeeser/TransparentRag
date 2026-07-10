"use client";

import { ChevronDown, ChevronRight, UploadCloud } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Loader } from "@/components/ui/loader";
import { GlassCard } from "@/components/ui/panel";
import { fetchDocumentChunks, fetchDocuments, uploadDocument } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { cn, prettyJson, truncate } from "@/lib/utils";

import type { Chunk, Document } from "@/lib/types";
import type { ChangeEvent } from "react";

type CollectionDocumentsProps = {
  collectionId: string;
  token: string;
};

export function CollectionDocuments({ collectionId, token }: CollectionDocumentsProps) {
  const router = useRouter();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [chunksByDocument, setChunksByDocument] = useState<Record<string, Chunk[]>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<Record<string, boolean>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadDocuments() {
      setLoading(true);
      setMessage(null);
      try {
        const docs = await fetchDocuments(token, collectionId);
        if (!cancelled) {
          setDocuments(docs);
        }
      } catch (error) {
        if (!cancelled) {
          setMessage(getErrorMessage(error, "Unable to load documents."));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (collectionId && token) {
      loadDocuments();
    }

    return () => {
      cancelled = true;
    };
  }, [collectionId, token]);

  const loadChunks = async (documentId: string) => {
    setWorking((prev) => ({ ...prev, [documentId]: true }));
    try {
      const payload = await fetchDocumentChunks(token, documentId);
      setChunksByDocument((prev) => ({ ...prev, [documentId]: payload.chunks }));
    } catch (error) {
      setMessage(getErrorMessage(error, "Unable to load chunks."));
    } finally {
      setWorking((prev) => ({ ...prev, [documentId]: false }));
    }
  };

  const toggleDocument = (doc: Document) => {
    const willOpen = !expanded[doc.id];
    setExpanded((prev) => ({ ...prev, [doc.id]: willOpen }));
    if (willOpen && !chunksByDocument[doc.id]) {
      loadChunks(doc.id);
    }
  };

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setMessage(null);
    try {
      await uploadDocument(token, collectionId, file);
      const docs = await fetchDocuments(token, collectionId);
      setDocuments(docs);
      setMessage(`Uploaded ${file.name}. Chunking in progress.`);
    } catch (error) {
      setMessage(getErrorMessage(error, "Upload failed."));
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const openTrace = (documentId: string, chunkId?: string | null) => {
    const chunkParam = chunkId ? `?chunk=${encodeURIComponent(chunkId)}` : "";
    router.push(`/traces/documents/${documentId}${chunkParam}`);
  };

  return (
    <div className="space-y-6">
      <GlassCard className="rounded-3xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.35em] text-muted">
              Documents
            </p>
            <h2 className="text-2xl font-semibold text-primary">Sources and chunk lineage</h2>
            <p className="text-sm text-muted">
              Expand a document to inspect every chunk and its metadata.
            </p>
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
          <input ref={fileInputRef} type="file" className="hidden" onChange={handleUpload} />
        </div>
        {message && (
          <div className="mt-4 rounded-2xl border border-hairline bg-surface p-3 text-sm text-body">
            {message}
          </div>
        )}
      </GlassCard>

      {loading ? (
        <GlassCard className="flex items-center justify-center rounded-3xl p-10">
          <Loader className="h-6 w-6" />
        </GlassCard>
      ) : documents.length === 0 ? (
        <GlassCard className="rounded-3xl p-6 text-sm text-muted">
          No documents yet. Upload a file to start chunking.
        </GlassCard>
      ) : (
        <div className="space-y-4">
          {documents.map((doc) => {
            const isOpen = expanded[doc.id];
            const chunks = chunksByDocument[doc.id] ?? [];
            const isLoadingChunks = working[doc.id];
            return (
              <GlassCard key={doc.id} className="rounded-3xl border border-hairline p-4">
                <button
                  type="button"
                  onClick={() => toggleDocument(doc)}
                  className="flex w-full items-center justify-between gap-4 rounded-2xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-violet focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
                >
                  <div>
                    <p className="text-base font-semibold text-primary">{doc.name}</p>
                    <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">
                      {doc.status.toUpperCase()} | {doc.num_chunks} chunks | {doc.num_tokens} tokens
                    </p>
                  </div>
                  <span
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-full border border-hairline text-body transition",
                      isOpen && "border-accent-violet text-accent-violet",
                    )}
                  >
                    {isOpen ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </span>
                </button>

                {isOpen && (
                  <div className="mt-4 space-y-4 border-t border-hairline pt-4">
                    <div className="grid gap-3 md:grid-cols-3">
                      {[
                        { label: "Chunk size", value: doc.chunk_size },
                        { label: "Chunk overlap", value: doc.chunk_overlap },
                        { label: "Chunk strategy", value: doc.chunk_strategy },
                      ].map((item) => (
                        <div
                          key={`${doc.id}-${item.label}`}
                          className="rounded-2xl border border-hairline bg-surface p-3 text-sm"
                        >
                          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted">
                            {item.label}
                          </p>
                          <p className="mt-2 text-sm text-primary">{item.value}</p>
                        </div>
                      ))}
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <Button variant="secondary" size="sm" onClick={() => openTrace(doc.id)}>
                        View ingestion trace
                      </Button>
                      {doc.ingestion_run_id && (
                        <p className="text-xs text-muted">Trace run: {doc.ingestion_run_id}</p>
                      )}
                    </div>

                    {isLoadingChunks ? (
                      <div className="flex items-center gap-2 text-sm text-muted">
                        <Loader className="h-4 w-4" />
                        Loading chunks...
                      </div>
                    ) : chunks.length === 0 ? (
                      <p className="text-sm text-muted">No chunks ready yet.</p>
                    ) : (
                      <div className="space-y-3">
                        {chunks.map((chunk) => (
                          <details
                            key={chunk.id}
                            className="rounded-2xl border border-hairline bg-surface px-4 py-3"
                          >
                            <summary className="cursor-pointer text-sm text-body">
                              Chunk #{chunk.chunk_index} - {truncate(chunk.text, 90)}
                            </summary>
                            <div className="mt-3 space-y-3 text-sm text-body">
                              <div>
                                <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted">
                                  Full text
                                </p>
                                <p className="mt-2 whitespace-pre-wrap text-primary">
                                  {chunk.text}
                                </p>
                              </div>
                              <div>
                                <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted">
                                  Metadata
                                </p>
                                <pre className="mt-2 whitespace-pre-wrap rounded-xl border border-hairline bg-canvas p-3 text-xs text-body">
                                  {prettyJson(chunk.metadata)}
                                </pre>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openTrace(doc.id, chunk.id)}
                              >
                                Trace this chunk
                              </Button>
                            </div>
                          </details>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </GlassCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
