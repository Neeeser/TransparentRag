"use client";

import { useParams } from "next/navigation";

import {
  CollectionProvider,
  useCollection,
} from "@/components/collections/detail/collection-context";
import { CollectionSidebar } from "@/components/collections/detail/CollectionSidebar";

import type { ReactNode } from "react";

function CollectionShell({ children }: { children: ReactNode }) {
  const { collection } = useCollection();
  return (
    <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
      <div className="lg:sticky lg:top-6 lg:self-start">
        <CollectionSidebar collection={collection} />
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export default function CollectionLayout({ children }: { children: ReactNode }) {
  const params = useParams<{ collectionId: string }>();
  return (
    <CollectionProvider collectionId={params.collectionId}>
      <CollectionShell>{children}</CollectionShell>
    </CollectionProvider>
  );
}
