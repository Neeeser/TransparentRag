"use client";

import { useCollection } from "@/components/collections/detail/collection-context";
import { CollectionOverview } from "@/components/collections/detail/CollectionOverview";

export default function CollectionOverviewPage() {
  const { collection, stats, ingestionPipelines, retrievalPipelines, token, onCollectionUpdated } =
    useCollection();
  return (
    <CollectionOverview
      collection={collection}
      stats={stats}
      ingestionPipelines={ingestionPipelines}
      retrievalPipelines={retrievalPipelines}
      token={token}
      onCollectionUpdated={onCollectionUpdated}
    />
  );
}
