"use client";

import { useParams, useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { TraceDebugger } from "@/components/traces/debugger/TraceDebugger";

function DocumentTrace() {
  const params = useParams<{ documentId: string }>();
  const searchParams = useSearchParams();
  return (
    <TraceDebugger
      source={{ kind: "document", id: params.documentId, chunkId: searchParams.get("chunk") }}
    />
  );
}

export default function DocumentTracePage() {
  return (
    <Suspense>
      <DocumentTrace />
    </Suspense>
  );
}
