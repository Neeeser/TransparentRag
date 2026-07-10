"use client";

import { useParams, useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { TraceDebugger } from "@/components/traces/debugger/TraceDebugger";

function RunTrace() {
  const params = useParams<{ runId: string }>();
  const searchParams = useSearchParams();
  return (
    <TraceDebugger source={{ kind: "run", id: params.runId, chunkId: searchParams.get("chunk") }} />
  );
}

export default function RunTracePage() {
  return (
    <Suspense>
      <RunTrace />
    </Suspense>
  );
}
