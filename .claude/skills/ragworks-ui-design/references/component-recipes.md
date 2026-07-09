# Ragworks UI — Component recipes

Copy-paste-ready snippets for the deep-space look. All classes are Tailwind v4 as used in
`frontend/`. Prefer the shared primitives (`Button`, `Field`, `GlassCard`) where one
exists; these recipes are for link-CTAs, new compositions, and the atmosphere layers that
have no primitive yet. Reference implementations live in
`frontend/src/components/landing/`.

## Eyebrow / section kicker (mono instrument label)

```tsx
<p className="flex items-center gap-2.5 font-mono text-[11px] uppercase tracking-[0.4em] text-slate-400">
  <span className="h-1.5 w-1.5 rounded-full bg-cyan-300" aria-hidden />
  Open-source RAG workbench
</p>
```

Live/active variant with a pinging dot. The ping loops forever, so gate it with
`motion-reduce:animate-none` — infinite decorative motion must honor reduced motion just
like entrances do:

```tsx
<span className="relative flex h-1.5 w-1.5">
  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-300 opacity-60 motion-reduce:animate-none" />
  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-cyan-300" />
</span>
```

## Headline with one gradient word

Spend the gradient on a single word — the rest stays white.

```tsx
<h1 className="max-w-4xl text-balance text-5xl font-semibold leading-[1.02] tracking-tight text-white sm:text-6xl md:text-7xl">
  Every RAG signal,{" "}
  <span className="bg-gradient-to-r from-violet-300 via-fuchsia-200 to-cyan-300 bg-clip-text text-transparent">
    surfaced.
  </span>
</h1>
```

## Primary CTA (filled violet, glowing) — as a link

```tsx
<Link
  href="/auth/sign-in"
  className="group flex items-center gap-2 rounded-full bg-violet-500 px-6 py-3 text-base font-semibold text-white shadow-lg shadow-violet-500/30 transition hover:bg-violet-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#05060a]"
>
  Launch console
  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
</Link>
```

For real `<button>`s use `<Button variant="primary">` from `components/ui/button.tsx`.

## Secondary CTA (hairline outline, glass fill)

```tsx
<a
  href={GITHUB_URL}
  target="_blank"
  rel="noreferrer"
  className="flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-6 py-3 text-base font-medium text-white transition hover:border-white/30 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#05060a]"
>
  <Github className="h-4 w-4" aria-hidden />
  View source
</a>
```

## Stage/label strip (color-coded, mono)

Use this **only where the screen is genuinely about the pipeline stages** (a pipeline view,
a stage legend, a trace). It is not decoration — do not drop it onto unrelated screens
(login, generic empty states) to add color; that's the filler this design language avoids
(see design-language.md §2, principle 1).

```tsx
const STAGES = [
  { label: "Parse", dotClass: "bg-sky-400" },
  { label: "Chunk", dotClass: "bg-teal-400" },
  { label: "Embed", dotClass: "bg-amber-400" },
  { label: "Index", dotClass: "bg-cyan-400" },
  { label: "Retrieve", dotClass: "bg-emerald-400" },
  { label: "Chat", dotClass: "bg-rose-400" },
];

<ul className="flex flex-wrap items-center justify-center gap-x-1 gap-y-3 font-mono text-[11px] uppercase tracking-[0.28em] text-slate-400">
  {STAGES.map((s, i) => (
    <li key={s.label} className="flex items-center">
      <span className="flex items-center gap-2">
        <span className={`h-1.5 w-1.5 rounded-full ${s.dotClass}`} aria-hidden />
        {s.label}
      </span>
      {i < STAGES.length - 1 && <span className="mx-3 text-slate-700" aria-hidden>/</span>}
    </li>
  ))}
</ul>
```

## Card / panel

Prefer `GlassCard` from `components/ui/panel.tsx`. Inline equivalent:

```tsx
<div className="rounded-3xl border border-white/10 bg-white/5 p-6">…</div>
```

## Atmosphere layers (blooms + bottom fade)

Place behind content inside a `relative overflow-hidden` container:

```tsx
<div className="pointer-events-none absolute inset-0" aria-hidden>
  <div className="absolute inset-0 bg-[radial-gradient(60%_50%_at_18%_12%,rgba(139,92,246,0.22),transparent_60%)]" />
  <div className="absolute inset-0 bg-[radial-gradient(55%_45%_at_85%_10%,rgba(34,211,238,0.16),transparent_60%)]" />
  <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-[#05060a] to-transparent" />
</div>
```

## Staggered entrance

`landingRise` is defined in `globals.css` and no-ops under reduced motion. Apply
`.landing-rise` and stagger with inline `animationDelay`:

```tsx
<p className="landing-rise …" style={{ animationDelay: "0ms" }}>…</p>
<h1 className="landing-rise …" style={{ animationDelay: "80ms" }}>…</h1>
<p className="landing-rise …" style={{ animationDelay: "160ms" }}>…</p>
```

If you copy this look into a fresh project that lacks the keyframe, add it to `globals.css`
(see design-language.md §9).

## Reduced-motion preference (hydration-safe)

Never read the preference in a `useState` initializer or a `setState`-in-effect (both trip
lint / cause hydration mismatch). Use `useSyncExternalStore`:

```tsx
function usePrefersReducedMotion(): boolean {
  const q = "(prefers-reduced-motion: reduce)";
  return useSyncExternalStore(
    (onChange) => {
      const m = window.matchMedia(q);
      m.addEventListener("change", onChange);
      return () => m.removeEventListener("change", onChange);
    },
    () => window.matchMedia(q).matches,
    () => false, // server snapshot: assume motion allowed
  );
}
```

## The pipeline as ambient backdrop (signature technique)

The pivotal move: render the **real** pipeline visualization (`FlowPlayer`) faint, looping,
and non-interactive behind the hero — never a fake graphic, never real user data. It runs
on a hand-authored, in-memory synthetic graph so it works on a public/unauthenticated page
with zero network calls.

- `FlowPlayer` accepts `ambient` (hides controls, disables interaction, loops) and
  `autoPlay`. Feed it `nodes`/`edges`/`steps` you build in a small pure module (see
  `frontend/src/components/landing/lib/demo-flow.ts` for the reference synthetic graph).
- Wrap it in a masked, low-opacity, `aria-hidden` layer so it fades at the edges and clears
  the copy:

```tsx
<div
  aria-hidden
  className="pointer-events-none absolute inset-0 opacity-30 [mask-image:radial-gradient(105%_42%_at_50%_50%,black_45%,transparent_85%)]"
>
  <FlowPlayer nodes={nodes} edges={edges} steps={steps} ambient autoPlay={!prefersReducedMotion} />
</div>
```

- Leave a **clear band** in the hero layout for the flow to run through, so nodes never sit
  under a line of text (the landing hero inserts a `h-24 sm:h-32` spacer between headline
  and subhead for exactly this).
- Because it's the same component the trace viewer uses, improvements to the pipeline
  visuals flow to both places automatically. Keep it that way — don't fork a "landing-only"
  copy.

For a non-pipeline screen that still wants a living backdrop, reuse whatever real component
tells that screen's story (a trace graph, a chart) at low opacity — the principle is
"show the product faintly," not "add abstract motion."
