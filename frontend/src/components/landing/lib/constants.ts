/** Shared landing-page constants — defined once, used by the top bar and footer. */

export const GITHUB_URL = "https://github.com/Neeeser/Ragworks";
export const CONSOLE_HREF = "/auth/sign-in";
export const LICENSE_LABEL = "MIT License";

/**
 * The pipeline stages, in flow order, with the color family each uses in the
 * pipeline editor and the hero backdrop. The capability strip reuses these so
 * its dots match the running flow above it.
 */
export const PIPELINE_STAGES: { label: string; dotClass: string }[] = [
  { label: "Parse", dotClass: "bg-sky-400" },
  { label: "Chunk", dotClass: "bg-teal-400" },
  { label: "Embed", dotClass: "bg-amber-400" },
  { label: "Index", dotClass: "bg-cyan-400" },
  { label: "Retrieve", dotClass: "bg-emerald-400" },
  { label: "Chat", dotClass: "bg-rose-400" },
];
