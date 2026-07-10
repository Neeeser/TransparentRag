"use client";

/** Inline error channel for wizard steps; renders nothing when clear. */
export function SetupNotice({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="rounded-2xl border border-data-neg/40 bg-data-neg/10 px-4 py-3 text-sm text-data-neg"
    >
      {message}
    </p>
  );
}
