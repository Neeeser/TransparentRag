"use client";

import { useCollection } from "@/components/collections/detail/collection-context";
import { CollectionVisualization } from "@/components/collections/detail/visualize/CollectionVisualization";

export default function CollectionVisualizePage() {
  const { collection, token } = useCollection();
  return <CollectionVisualization collectionId={collection.id} token={token} />;
}
