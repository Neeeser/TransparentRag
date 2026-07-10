"use client";

import { useParams, useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { TraceDebugger } from "@/components/traces/debugger/TraceDebugger";

function QueryTrace() {
  const params = useParams<{ queryEventId: string }>();
  const searchParams = useSearchParams();
  return (
    <TraceDebugger
      source={{ kind: "query", id: params.queryEventId, chunkId: searchParams.get("chunk") }}
    />
  );
}

export default function QueryTracePage() {
  return (
    <Suspense>
      <QueryTrace />
    </Suspense>
  );
}
