import { Github } from "lucide-react";
import Link from "next/link";

import { CONSOLE_HREF, GITHUB_URL } from "@/components/landing/lib/constants";

/** Minimal top bar: wordmark on the left, GitHub + console entry on the right. */
export function LandingTopBar() {
  return (
    <header className="flex items-center justify-between">
      <span className="flex items-center gap-2 font-mono text-sm font-medium uppercase tracking-[0.32em] text-white">
        <span
          className="h-2 w-2 rounded-full bg-gradient-to-r from-violet-400 to-cyan-300"
          aria-hidden
        />
        Ragworks
      </span>
      <nav className="flex items-center gap-1 sm:gap-2">
        <a
          href={GITHUB_URL}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 rounded-full px-3 py-2 text-sm text-slate-300 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
        >
          <Github className="h-4 w-4" aria-hidden />
          <span className="hidden sm:inline">GitHub</span>
        </a>
        <Link
          href={CONSOLE_HREF}
          className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white transition hover:border-white/30 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
        >
          Console
        </Link>
      </nav>
    </header>
  );
}
