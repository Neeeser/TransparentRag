/** Fit chunk settings within provider-published embedding input limits. */
export function fitChunkingToModelLimit(
  chunkSize: number,
  chunkOverlap: number,
  contextLength: number | null | undefined,
): { chunkSize: number; chunkOverlap: number } {
  if (typeof contextLength !== "number" || !Number.isFinite(contextLength) || contextLength <= 0) {
    return { chunkSize, chunkOverlap };
  }
  const maximum = Math.floor(contextLength);
  const safeSize = Math.min(chunkSize, maximum);
  return {
    chunkSize: safeSize,
    chunkOverlap: Math.min(chunkOverlap, Math.max(0, safeSize - 1)),
  };
}
