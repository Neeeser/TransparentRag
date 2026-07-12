"use client";

import { useCollection } from "@/components/collections/detail/collection-context";
import { CollectionSearch } from "@/components/collections/detail/CollectionSearch";

export default function CollectionSearchPage() {
  const { collection, token } = useCollection();
  return <CollectionSearch collectionId={collection.id} token={token} />;
}
