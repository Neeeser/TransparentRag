"use client";

import { ArrowDown, X } from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useState } from "react";

import { FlowPlayer } from "@/components/pipelines/flow/FlowPlayer";
import { traceNodeTypes } from "@/components/traces/IndexStoreNode";
import { buildTraceGraph } from "@/components/traces/trace-graph";
import { TraceIOColumn } from "@/components/traces/TraceIOColumn";
import { Button } from "@/components/ui/button";
import { ModalOverlay } from "@/components/ui/modal-overlay";
import { GlassCard } from "@/components/ui/panel";
import { fetchPipelineNodes } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";

import type { NodeSpec, PipelineTraceResponse } from "@/lib/types";

type PipelineTraceViewerProps = {
  trace: PipelineTraceResponse | null;
  /**
   * The ingestion run that produced the traced chunk. When present, the viewer
   * plays the document's ingestion first, then the retrieval, as one flow.
   */
  originTrace?: PipelineTraceResponse | null;
  /** Optional explicit token; falls back to the signed-in user's token when omitted. */
  token?: string;
  /** When provided, skips the internal node-spec fetch and uses these instead. */
  nodeSpecs?: NodeSpec[];
  isOpen: boolean;
  onClose: () => void;
  highlightChunkId?: string | null;
};

export function PipelineTraceViewer({
  trace,
  originTrace = null,
  token,
  nodeSpecs: providedNodeSpecs,
  isOpen,
  onClose,
  highlightChunkId,
}: PipelineTraceViewerProps) {
  const titleId = useId();
  const { token: authToken } = useAuth();
  const [fetchedNodeSpecs, setFetchedNodeSpecs] = useState<NodeSpec[]>([]);
  const [specsLoaded, setSpecsLoaded] = useState(false);
  const [nodeSpecsError, setNodeSpecsError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [showInputPayloads, setShowInputPayloads] = useState(false);
  const [showOutputPayloads, setShowOutputPayloads] = useState(false);

  const nodeSpecs = providedNodeSpecs ?? fetchedNodeSpecs;

  useEffect(() => {
    if (!isOpen || providedNodeSpecs || specsLoaded) return;
    let cancelled = false;
    const effectiveToken = token ?? authToken ?? "";
    fetchPipelineNodes(effectiveToken)
      .then((specs) => {
        if (!cancelled) {
          setFetchedNodeSpecs(specs);
          setSpecsLoaded(true);
          setNodeSpecsError(null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSpecsLoaded(true);
          setNodeSpecsError(
            "Node details are unavailable right now; showing the trace without them.",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, providedNodeSpecs, specsLoaded, token, authToken]);

  const graph = useMemo(
    () => (trace ? buildTraceGraph(trace, originTrace, nodeSpecs) : null),
    [trace, originTrace, nodeSpecs],
  );

  const handleActiveStepChange = useCallback((index: number) => {
    setActiveIndex(index);
    setShowInputPayloads(false);
    setShowOutputPayloads(false);
  }, []);

  if (!isOpen || !trace || !graph) {
    return null;
  }

  const activeStep = graph.steps[activeIndex];
  const activeRun = activeStep?.run ?? null;
  const activeSummary = activeRun?.summary ?? { inputs: [], outputs: [] };

  return (
    <ModalOverlay
      open={isOpen}
      onClose={onClose}
      labelledBy={titleId}
      backdropClassName="px-6 py-6"
    >
      {/* Definite viewport-relative height (matching the backdrop's py-6 =
          3rem) so the inner flex-1 IO region can bound and scroll; a plain
          h-full has no definite basis here and would overflow on short/mobile
          screens, clipping the header. */}
      <div className="relative flex h-[calc(100dvh-3rem)] w-full max-w-6xl flex-col overflow-hidden rounded-[24px] border border-hairline bg-canvas-raised shadow-elevation-2 sm:rounded-[32px]">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-hairline px-4 py-3 sm:px-6 sm:py-4">
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-meta sm:text-[11px]">
              {graph.combined ? "End-to-end trace" : "Pipeline trace"}
            </p>
            <h2 id={titleId} className="truncate text-base font-semibold text-primary sm:text-xl">
              {graph.combined ? "Document → retrieval" : `${trace.run.status.toUpperCase()} trace`}
            </h2>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            {highlightChunkId && (
              <span className="hidden max-w-[200px] truncate rounded-full border border-accent-cyan/40 bg-accent-cyan/10 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.3em] text-accent-cyan lg:inline-block">
                chunk {highlightChunkId}
              </span>
            )}
            <Button variant="ghost" size="sm" onClick={onClose} className="gap-2">
              <X className="h-4 w-4" />
              <span className="hidden sm:inline">Close</span>
            </Button>
          </div>
        </div>

        {/* Fixed regions (banner, graph, active node) stay pinned; only the IO
            region below scrolls, so stepping never reflows the layout. */}
        <div className="flex min-h-0 flex-1 flex-col gap-3 p-4 sm:gap-4 sm:p-6">
          {nodeSpecsError && (
            <div className="shrink-0 rounded-2xl border border-data-warn/40 bg-data-warn/10 px-4 py-2 text-xs text-data-warn">
              {nodeSpecsError}
            </div>
          )}
          {graph.combined && (
            <div className="flex shrink-0 flex-wrap items-center gap-2 text-[11px] text-muted">
              <span className="flex items-center gap-1.5 rounded-full border border-accent-cyan/30 bg-accent-cyan/10 px-3 py-1 text-accent-cyan">
                <span className="h-1.5 w-1.5 rounded-full bg-accent-cyan" /> Ingestion — how this
                chunk was made
              </span>
              <ArrowDown className="h-3.5 w-3.5 rotate-[-90deg] text-meta sm:rotate-0" />
              <span className="flex items-center gap-1.5 rounded-full border border-accent-violet/30 bg-accent-violet/10 px-3 py-1 text-accent-violet">
                <span className="h-1.5 w-1.5 rounded-full bg-accent-violet" /> Retrieval — how it
                was found
              </span>
            </div>
          )}
          <GlassCard className="relative shrink-0 overflow-hidden rounded-3xl border border-hairline bg-surface">
            {/* ReactFlow needs a concretely sized parent, not min-height. */}
            <div
              className={cn(graph.combined ? "h-[300px] sm:h-[440px]" : "h-[240px] sm:h-[380px]")}
            >
              <FlowPlayer
                nodes={graph.nodes}
                edges={graph.edges}
                steps={graph.steps}
                nodeTypes={graph.combined ? traceNodeTypes : undefined}
                onActiveStepChange={handleActiveStepChange}
              />
            </div>
          </GlassCard>

          <div className="flex shrink-0 items-center justify-between gap-2 rounded-3xl border border-hairline bg-surface px-4 py-3">
            <div className="min-w-0">
              <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-muted sm:text-[11px]">
                {activeStep ? activeStep.stageLabel : "Active node"}
              </p>
              <h3 className="truncate text-base font-semibold text-primary sm:text-lg">
                {activeRun?.node_name || activeStep?.nodeId || "—"}
              </h3>
            </div>
            {activeRun && (
              <span className="shrink-0 rounded-full border border-hairline bg-surface-strong px-3 py-1 font-mono text-[10px] uppercase tracking-[0.3em] text-muted">
                {activeRun.status}
              </span>
            )}
          </div>

          {/* The only scrolling region — locked height, big values scroll here. */}
          <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto md:grid-cols-2">
            <TraceIOColumn
              title="Inputs"
              tone="cyan"
              summaryItems={activeSummary.inputs}
              ioRecords={activeStep?.io.inputs}
              highlightChunkId={highlightChunkId}
              showPayloads={showInputPayloads}
              onTogglePayloads={() => setShowInputPayloads((prev) => !prev)}
              emptySummaryLabel="No primary inputs recorded."
              emptyIoLabel="No inputs recorded."
            />
            <TraceIOColumn
              title="Outputs"
              tone="violet"
              summaryItems={activeSummary.outputs}
              ioRecords={activeStep?.io.outputs}
              highlightChunkId={highlightChunkId}
              showPayloads={showOutputPayloads}
              onTogglePayloads={() => setShowOutputPayloads((prev) => !prev)}
              emptySummaryLabel="No primary outputs recorded."
              emptyIoLabel="No outputs recorded."
            />
          </div>
        </div>
      </div>
    </ModalOverlay>
  );
}
