---
name: ragworks-ui-design
description: >-
  The Ragworks frontend visual design language — the "deep-space observability" look
  established by the landing page (near-black canvas, violet→cyan trace-color accents,
  hairline structure, monospace instrument labels, restrained motion, and the product's
  own pipeline used as ambient atmosphere). Use this skill WHENEVER building or restyling
  any UI in the Ragworks `frontend/` — new pages, components, panels, forms, empty states,
  modals, dashboards — or when asked to "match the landing page," "apply the new design,"
  "make it look like the front page," "restyle," "modernize the UI," "bring this in line,"
  or to touch colors, typography, buttons, spacing, or animation anywhere in the app. When
  in doubt about any visual choice in this project, consult this skill rather than
  inventing a new style — consistency with this system is the goal.
---

# Ragworks UI Design

Ragworks is an observability tool for RAG pipelines. Its UI should feel like the
**instrument panel of a precise machine floating in deep space**: a near-black canvas,
faint light in the product's own violet→cyan trace colors, hairline structure, monospace
telemetry labels, and the pipeline itself treated as the hero. Color is spent
deliberately; everything quiet stays quiet so the signal reads.

This skill is the working playbook. For the full rationale, the complete token set, and
the motion/atmosphere techniques, read:

- `references/design-language.md` — the detailed spec (the *why* + every token).
- `references/component-recipes.md` — copy-paste-ready snippets for each element.

Reference implementation: `frontend/src/components/landing/`. Shared primitives:
`components/ui/button.tsx`, `components/ui/field.tsx`, `components/ui/panel.tsx`.

## The principles

1. **Text is sparing — let the design speak.** This is the one contributors most often get
   wrong. Every word must earn its place. Do **not** add eyebrows, subheads, captions,
   feature lists, or label strips that restate what a visual (a running pipeline, a form, a
   chart) already communicates. If a screen reads clearly without a line of copy, cut the
   copy. A sign-in form needs a heading and fields — not a subhead explaining what a
   workspace is, and not a decorative pipeline-stage strip. Prefer silence to filler; the
   visuals and the interaction carry the meaning.
2. **Quiet by default, bright on purpose.** Near-black base, soft-white text. Saturated
   color appears only where it *means* something — the accent gradient on one word, a
   violet primary button, a real pipeline's stage colors. If five things glow, nothing reads.
3. **Structure is hairline.** Separation is `border-white/10` + subtle `bg-white/5`, not
   heavy panels or drop shadows. The darkness does the work.
4. **Labels are instruments.** Any label that *does* earn its place and isn't a full
   sentence (a field label, a real section kicker, a stat caption, a table header, a status)
   is monospace, uppercase, and letter-spaced. This styles the labels you keep — it is not a
   licence to add more.
5. **The subject is the decoration.** Where a screen can show the product working (a
   pipeline, trace, or flow), that *is* the visual interest — reuse the real component at
   low opacity. Never invent abstract decorative shapes, and never substitute a text strip
   for a visual.
6. **Motion is orchestrated, not sprinkled.** One entrance or one ambient loop, always
   honoring `prefers-reduced-motion`. Extra motion is the fastest way to look generated.

## Token quick-reference

Use these exact values (full table in `design-language.md §3–6`):

- **Base:** `bg-[#05060a]`. **Surfaces:** `bg-white/5`, faintest `bg-white/[0.04]`.
  **Borders:** `border-white/10` (hairline), `white/12`, hover `white/30`.
- **Text:** white → `slate-300` (body) → `slate-400` (labels) → `slate-500` (meta) →
  `slate-700` (separators).
- **Accents (sparingly):** violet `#8b5cf6` (`violet-500`, primary/ingestion), cyan
  `#22d3ee` (`cyan-300/400`, retrieval/live). **Accent gradient** (one element per view):
  `from-violet-300 via-fuchsia-200 to-cyan-300`.
- **Pipeline stage colors (semantic, shared with the editor/trace viewer — never
  reassign):** Parse `sky-400`, Chunk `teal-400`, Embed `amber-400`, Index `cyan-400`,
  Retrieve `emerald-400`, Chat `rose-400`.
- **Type:** Geist Sans (display/body) + Geist Mono (labels) — already loaded, **add no
  fonts**. Headlines `font-semibold tracking-tight` + `text-balance`; body `text-slate-300
  leading-relaxed text-pretty`.
- **Radii:** `rounded-full` (buttons/badges), `rounded-2xl` (inputs), `rounded-3xl`
  (cards). **Shadow = glow only** (`shadow-violet-500/30` under the primary button).

## The instrument label (memorize this)

```
font-mono text-[11px] uppercase tracking-[0.28em] text-slate-400
```

Tracking scales with prominence (`0.28em` dense → `0.4em` hero eyebrow); size stays small.
Pair with a small stage/status dot. Turning sentence-case gray labels into these does most
of the work of matching the look.

## Building UI

- **Real buttons →** `Button` (`components/ui/button.tsx`). **Link-CTAs →** the primary /
  secondary recipes in `component-recipes.md`.
- **Forms →** `Field`/`TextInput`/`Select`/`TextArea` and the exported `inputClass`. Never
  hand-roll the input class string.
- **Cards →** `GlassCard` or `rounded-3xl border-white/10 bg-white/5`.
- **Atmosphere & entrance →** blooms, the `landing-rise` stagger, and the reduced-motion
  hook are in `component-recipes.md`. Spend **one** accent per view.
- **A living backdrop →** render the real product component (`FlowPlayer`) faint, looping,
  non-interactive, masked — never fake data, never real user data. See the pipeline-backdrop
  recipe. It's the same component the trace viewer uses; keep it that way.

## Restyling an existing screen (do in this order)

1. **Cut text first.** Remove subheads/captions/feature-lists/label-strips that restate what
   the UI already shows (principle 1). This is the highest-value step and the easiest to skip.
2. Rewrite the labels you *keep* in the instrument voice.
3. Normalize color to the palette (base → `#05060a`, text ramp, `white/10` borders);
   delete stray accents that carry no meaning.
4. Swap to shared primitives + the button/input recipes; delete bespoke styles.
5. At most one deliberate accent, and only if it adds meaning — usually a single gradient
   word. Do not add a decorative stage-dot strip or any label row that just names things the
   screen isn't about.
6. Add a restrained entrance if the screen has a clear first-paint hierarchy; skip it on
   dense dashboards where it would be noise.
7. A subject backdrop only where it fits (landing/empty/overview). Working screens want calm.

## Quality floor (part of "done")

- `focus-visible:ring-2 ring-violet-300/400` + `ring-offset` on every interactive element;
  `aria-label` on icon-only buttons.
- Entrances/loops no-op under `prefers-reduced-motion` (read it via `useSyncExternalStore`,
  not `useState`+effect). This includes infinite CSS accents like a pinging status dot —
  gate them with `motion-reduce:animate-none`. Decorative layers get `aria-hidden` +
  `pointer-events-none`.
- Fluid type, wrapping strips, no horizontal page scroll; `overflow-hidden` around animated
  layers. Body text is `slate-300`, not `slate-500`.
- Sentence-case copy, plain verbs, no marketing adjectives — it's an open-source tool.
- Finish with `npm run verify` (from `frontend/`) and a keyboard-focus + reduced-motion pass.

## Anti-patterns

Decorative text — a subhead that narrates an adjacent visual, or a label/stage strip that
restates what the screen already shows · sentence-case gray labels where an instrument label
belongs · more than one glowing element per viewport · hand-rolled overlays/buttons/input
strings instead of the primitives · heavy shadows or bright 1px borders for elevation ·
abstract decorative blobs instead of the real product · autoplaying motion that ignores
reduced motion · adding fonts or new accent hues.
