"use client";

import { useCollection } from "@/components/collections/detail/collection-context";
import { FilesBrowser } from "@/components/files/FilesBrowser";

type FilesPageProps = {
  pathSegments: string[];
};

/** Files route body; collection data and navigation come from the layout. */
export function FilesPage({ pathSegments }: FilesPageProps) {
  const { token, collection } = useCollection();
  return (
    <FilesBrowser
      token={token}
      collectionId={collection.id}
      collectionName={collection.name}
      pathSegments={pathSegments}
    />
  );
}
