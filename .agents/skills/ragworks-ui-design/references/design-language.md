# Ragworks UI — Design Language (detailed spec)

This is the full rationale and token reference behind the "deep-space observability"
look established by the landing page (`frontend/src/components/landing/`). SKILL.md is the
working playbook; read this when you need the *why* behind a choice, the complete token
set, or the motion/atmosphere techniques.

## Table of contents

1. [The idea in one paragraph](#1-the-idea-in-one-paragraph)
2. [Principles](#2-principles)
3. [Color](#3-color)
4. [Typography](#4-typography)
5. [The mono "instrument" voice](#5-the-mono-instrument-voice)
6. [Surfaces, borders, radii, shadow](#6-surfaces-borders-radii-shadow)
7. [Buttons & interactive controls](#7-buttons--interactive-controls)
8. [Form controls](#8-form-controls)
9. [Motion](#9-motion)
10. [Atmosphere: blooms, grids, and the pipeline-as-backdrop](#10-atmosphere)
11. [Accessibility & quality floor](#11-accessibility--quality-floor)
12. [Voice & copy](#12-voice--copy)
13. [Applying this to existing screens](#13-applying-this-to-existing-screens)
14. [Anti-patterns](#14-anti-patterns)

---

## 1. The idea in one paragraph

Ragworks is an observability tool for RAG pipelines. The UI should feel like the
**instrument panel of a precise machine floating in deep space**: a near-black canvas,
faint atmospheric light in the product's own violet→cyan trace colors, hairline-thin
structure, and monospace labels that read like telemetry. Color is spent deliberately —
mostly on the one accent gradient and the pipeline's own stage colors — never sprayed
around. The most characteristic thing in the product (the pipeline flow, a document
moving through stages) is treated as the hero, not a decorative afterthought. Everything
else stays quiet so the signal reads.

## 2. Principles

- **Text is sparing — the design speaks.** The most common mistake is adding words the
  design doesn't need. Every word must earn its place. Don't add eyebrows, subheads,
  captions, feature lists, or label strips that restate what a visual or the interaction
  already communicates — a running pipeline already says "this is a RAG pipeline"; a
  sign-in form already says "sign in here." If a screen reads without a line of copy, cut
  the copy. Prefer silence to filler.
- **Quiet by default, bright on purpose.** The base is near-black with soft-white text.
  Saturated color appears only where it means something: the accent gradient on a key
  word, a violet primary button, the stage colors on a pipeline. A screen where five
  things glow is a screen where nothing reads.
- **Structure is hairline.** Separation comes from 1px `white/10` borders and subtle
  `white/5` fills, not heavy panels or drop shadows. The darkness does the work.
- **Labels are instruments.** Eyebrows, section labels, metadata, and stat captions are
  monospace, uppercase, and letter-spaced. This is the single most recognizable tell of
  the look and the cheapest way to bring an old screen in line.
- **The subject is the decoration.** Where a screen can show the product doing its thing
  (a pipeline, a trace, a flow), that *is* the visual interest. Reuse the real component
  at low opacity rather than inventing abstract shapes.
- **Motion is orchestrated, not sprinkled.** One considered entrance or one ambient loop
  beats a dozen hover wiggles. Everything respects `prefers-reduced-motion`.

## 3. Color

The palette is intentionally small. Use these exact values so screens match.

### Canvas & surfaces

| Role | Value | Notes |
| --- | --- | --- |
| Void (page base) | `#05060a` | The landing base — darker/cooler than the legacy `#030712`. Prefer it for new full-bleed backgrounds. |
| Legacy background | `#030712` (`--background`) | Existing app base; acceptable, but `#05060a` is the target. |
| Raised surface | `bg-white/5` | Cards, inputs, quiet chips. |
| Fainter surface | `bg-white/[0.04]` | Secondary buttons, the lightest fill. |
| Hairline border | `border-white/10` | Default separator. `white/12` for slightly more presence. |
| Hover border | `border-white/30` | Border brightening on hover for outline controls. |

### Text

| Role | Value |
| --- | --- |
| Primary / headline | `text-white` |
| Body | `text-slate-300` |
| Muted / labels | `text-slate-400` |
| Faint meta / footer | `text-slate-500` |
| Separators (`·`, `/`) | `text-slate-700` |

### Accents (spend sparingly)

| Role | Value | Meaning |
| --- | --- | --- |
| Primary accent | violet — `#8b5cf6` (`violet-500`), legacy `--accent` `#7c3aed` | Primary actions, brand, ingestion. |
| Secondary accent | cyan — `#22d3ee` (`cyan-300/400`) | Retrieval, live/active status, the "other half" of the gradient. |
| Accent gradient | `from-violet-300 via-fuchsia-200 to-cyan-300` | Reserved for **one** hero word or a single key figure per view. |

### Pipeline stage colors (semantic — do not reassign)

These come from `frontend/src/components/pipelines/lib/pipeline-theme.ts` and are shared
with the editor and trace viewer. Use them whenever you label or dot a pipeline stage so
the whole product speaks one color language.

| Stage / family | Dot class | Hex |
| --- | --- | --- |
| Parse / parser | `bg-sky-400` | `#38bdf8` |
| Chunk / chunker | `bg-teal-400` | `#2dd4bf` |
| Embed / embedder | `bg-amber-400` | `#fbbf24` |
| Index / indexer | `bg-cyan-400` | `#22d3ee` |
| Retrieve / retriever | `bg-emerald-400` | `#34d399` |
| Chat | `bg-rose-400` | `#fb7185` |

## 4. Typography

Two families, already loaded in `app/layout.tsx` — **do not add fonts**:

- **Geist Sans** (`--font-geist-sans`) — display and body.
- **Geist Mono** (`--font-geist-mono`, Tailwind `font-mono`) — labels, metadata, code.

### Display / headlines

- Weight `font-semibold`, `tracking-tight`, tight leading (`leading-[1.02]` on the big
  hero; `leading-tight` elsewhere).
- Fluid scale via responsive steps, largest at the hero:
  `text-5xl sm:text-6xl md:text-7xl` for a landing hero;
  `text-2xl`–`text-4xl` for in-app section titles.
- `text-balance` on headlines, `text-pretty` on paragraphs — avoids ragged orphan lines.
- Color: `text-white`. Optionally clip **one** word to the accent gradient (see §7 recipe).

### Body

- `text-slate-300`, `leading-relaxed`, `max-w-2xl`-ish measure for readability.

## 5. The mono "instrument" voice

The signature. Any label that isn't a full sentence — eyebrows, section kickers, stat
captions, tab labels, table column heads, footer links, status text — uses:

```
font-mono text-[11px] uppercase tracking-[0.28em] text-slate-400
```

- Tracking scales with prominence: `tracking-[0.28em]` for dense strips/footers,
  `tracking-[0.4em]` for a hero eyebrow. Never below `0.2em` — the spacing is the effect.
- Size stays small (`text-[10px]`–`text-xs`). These are captions, not content.
- Pair with a small colored dot when the label names a status or a pipeline stage.

This one substitution — turning sentence-case gray labels into mono uppercase tracked
labels — does most of the work of making a legacy screen feel like the new system.

## 6. Surfaces, borders, radii, shadow

- **Radii:** pills (`rounded-full`) for buttons, badges, and chips; `rounded-2xl` (inputs)
  and `rounded-3xl` (cards/panels) for containers. The existing `.glass-panel` (1.25rem)
  is fine for dense data panels. Keep a screen to one or two radius steps.
- **Cards:** prefer `GlassCard` (`frontend/src/components/ui/panel.tsx`) or the
  `.glass-panel` utility — `border-white/10` + a very subtle `bg-white/5` or the
  `from-white/5 via-transparent to-white/5` gradient. No hard 1px bright borders, no
  chunky shadows.
- **Shadow:** used almost only as *glow* — a colored, low-opacity halo under the primary
  button (`shadow-lg shadow-violet-500/30`) or the active pipeline node
  (`shadow-[0_0_32px_rgba(103,232,249,0.25)]`). Not for elevation drop-shadows.

## 7. Buttons & interactive controls

Prefer the shared `Button` primitive (`frontend/src/components/ui/button.tsx`) for real
buttons. For link-CTAs (anchors / `next/link`), match these recipes exactly.

**Primary (filled violet, glowing):**

```
rounded-full bg-violet-500 px-6 py-3 text-base font-semibold text-white
shadow-lg shadow-violet-500/30 transition hover:bg-violet-400
focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300
focus-visible:ring-offset-2 focus-visible:ring-offset-[#05060a]
```

**Secondary (hairline outline, glass fill):**

```
rounded-full border border-white/12 bg-white/[0.04] px-6 py-3 text-base font-medium
text-white transition hover:border-white/30 hover:bg-white/10
focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300
focus-visible:ring-offset-2 focus-visible:ring-offset-[#05060a]
```

**Ghost:** `text-slate-300 hover:text-white hover:bg-white/5` in a pill.

Micro-interactions: an icon inside a CTA nudges on hover
(`group` + `group-hover:translate-x-0.5` on a trailing arrow). Keep it to one small,
purposeful move — never bounce or spin.

## 8. Form controls

Use `Field` / `TextInput` / `Select` / `TextArea` (`frontend/src/components/ui/field.tsx`)
and the exported `inputClass`. The canonical input is:

```
w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white
outline-none transition focus:border-violet-400
```

Never hand-roll the input class string — it was copy-pasted 29 times before it was
centralized. Labels above inputs use the mono instrument voice (§5) at the small end.

## 9. Motion

Two moves cover almost everything.

**Entrance — staggered rise.** On first paint, content fades up a short distance. Defined
once in `globals.css` as `landingRise` and applied via `.landing-rise` with a per-element
`animationDelay` (0ms, 80ms, 160ms, 240ms, 320ms…). The curve is
`cubic-bezier(0.22, 1, 0.36, 1)` over ~0.7s — a confident settle, not a bounce.

```css
@keyframes landingRise {
  from { opacity: 0; transform: translateY(18px); }
  to   { opacity: 1; transform: translateY(0); }
}
.landing-rise { opacity: 0; animation: landingRise 0.7s cubic-bezier(0.22,1,0.36,1) forwards; }
@media (prefers-reduced-motion: reduce) {
  .landing-rise { animation: none !important; opacity: 1 !important; transform: none !important; }
}
```

**Ambient — a slow loop.** A living element (the pipeline flow) runs continuously and
quietly in the background. Always low opacity, always non-interactive, always paused under
reduced motion.

Everything else — hover color shifts, the icon nudge, the live-dot ping — is a small
accent, not a feature. Resist adding more; extra motion is the fastest way to make a page
read as generated rather than designed.

## 10. Atmosphere

Three layers, back to front, create the "deep space" depth without clutter:

1. **Void base** — `bg-[#05060a]`.
2. **Blooms** — two large, soft radial gradients in the accent colors, plus a bottom fade
   back to void. From the landing hero:
   ```
   bg-[radial-gradient(60%_50%_at_18%_12%,rgba(139,92,246,0.22),transparent_60%)]   /* violet, top-left */
   bg-[radial-gradient(55%_45%_at_85%_10%,rgba(34,211,238,0.16),transparent_60%)]    /* cyan, top-right */
   bg-gradient-to-t from-[#05060a] to-transparent                                    /* bottom fade */
   ```
   Keep bloom opacity ≤ ~0.22 — they are light leaking in, not spotlights.
3. **The subject as backdrop** — the pivotal technique: render the real product component
   (the pipeline `FlowPlayer`) as a faint, looping, non-interactive layer *behind* the
   content, masked so it fades at the edges and never fights the copy. See the
   pipeline-backdrop recipe in SKILL.md / component-recipes.md. On a data screen the
   equivalent is a real trace or graph at low opacity — never invent abstract "AI swoosh"
   shapes; the product's own instruments are more honest and more distinctive.

A subtle dot grid (`ReactFlow`'s `Background`, or a CSS radial-dot pattern) is acceptable
under content but optional — don't stack a grid *and* a busy backdrop.

## 11. Accessibility & quality floor

Non-negotiable, and part of "done":

- **Focus:** every interactive element shows `focus-visible:ring-2 ring-violet-300/400`
  with `ring-offset` in the surrounding bg color. Icon-only buttons get `aria-label`.
- **Reduced motion:** entrances and ambient loops must no-op under
  `prefers-reduced-motion: reduce`. Read the preference the hydration-safe way
  (`useSyncExternalStore`, not a `useState`+effect that trips the lint rule).
- **Contrast:** body text is `slate-300` (not `slate-500`) on the dark base; keep muted
  labels for non-essential text only.
- **Responsive:** fluid type steps, wrap strips (`flex-wrap`), never let the page scroll
  horizontally; wide/animated content gets `overflow-hidden` on its container.
- **Decorative layers** carry `aria-hidden` and `pointer-events-none`.

## 12. Voice & copy

Match the visual restraint in words:

- Sentence case, plain verbs, no marketing adjectives. Name things by what the user does.
- Buttons say the action and keep the same verb through the flow ("Launch console").
- Labels are nouns; a label labels, an example demonstrates — nothing does double duty.
- This is an open-source tool: describe what it does, don't sell it.

## 13. Applying this to existing screens

When restyling a legacy screen, do these in order — the first two get you 80% there:

1. **Rewrite labels in the mono instrument voice** (§5). Eyebrows, section kickers, table
   headers, stat captions, tab labels.
2. **Normalize color to the palette** (§3): base toward `#05060a`, text to the
   `white / slate-300 / slate-400` ramp, borders to `white/10`. Remove stray accent colors
   that don't carry meaning.
3. **Swap controls to the shared primitives** (`Button`, `Field`/`inputClass`, `GlassCard`)
   and the button/input recipes (§7–8). Delete any hand-rolled input class strings and
   bespoke button styles.
4. **Cut before you add.** Remove any subhead, caption, feature list, or label strip that
   restates what the screen already shows (see §2, principle 1) — this usually improves the
   screen more than anything you add. Then, at most **one** deliberate accent, and only if it
   carries meaning — usually a single gradient word. A decorative stage-dot strip on a screen
   that isn't about pipelines is exactly the kind of filler to avoid.
5. **Add a restrained entrance** (`landing-rise` with a short stagger) if the screen has a
   clear first-paint hierarchy. Skip it on dense dashboards where it would be noise.
6. **Consider a subject backdrop** only where it fits (a landing/empty/overview state).
   Dense working screens usually want calm, not ambience.

Always finish with the frontend gate (`npm run verify`) and check keyboard focus + a
reduced-motion pass.

## 14. Anti-patterns

- Decorative text: a subhead that narrates an adjacent visual, a feature/benefit list, or a
  label/stage strip that restates what the screen already shows. Cut it.
- Sentence-case gray labels where a mono instrument label belongs.
- More than one gradient/glowing element competing in a viewport.
- Hand-rolled `fixed inset-0` overlays, bespoke button classes, or copy-pasted input class
  strings instead of the shared primitives.
- Heavy drop shadows or bright 1px borders for elevation — use darkness + hairlines + glow.
- Abstract decorative blobs standing in for the product; show the real thing faintly.
- Autoplaying motion that ignores `prefers-reduced-motion`.
- Adding fonts or new accent hues — the palette and the two Geist families are the system.
