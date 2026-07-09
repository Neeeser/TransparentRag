import Link from "next/link";

import { CONSOLE_HREF, GITHUB_URL, LICENSE_LABEL } from "@/components/landing/lib/constants";

/** Quiet footer: the three links that matter for an OSS project. */
export function LandingFooter() {
  return (
    <footer className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 font-mono text-[11px] uppercase tracking-[0.28em] text-slate-500">
      <a
        href={GITHUB_URL}
        target="_blank"
        rel="noreferrer"
        className="transition hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
      >
        GitHub
      </a>
      <span className="text-slate-700" aria-hidden>
        ·
      </span>
      <Link
        href={CONSOLE_HREF}
        className="transition hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
      >
        Console
      </Link>
      <span className="text-slate-700" aria-hidden>
        ·
      </span>
      <span>{LICENSE_LABEL}</span>
    </footer>
  );
}
