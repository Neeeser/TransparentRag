"use client";

import { useParams } from "next/navigation";

import { CollectionDetail } from "@/components/collections/detail/CollectionDetail";

export default function CollectionDetailPage() {
  const params = useParams<{ collectionId: string }>();
  return <CollectionDetail collectionId={params.collectionId} />;
}
