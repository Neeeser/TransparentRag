# Navbar Mark Gradient Design

## Goal

Bring the Ragworks navbar mark into the console's deep-space visual language while preserving the split-and-merge pipeline silhouette and its clarity at the existing 56 × 29 px display size.

## Approved treatment

Use the coordinated split-gradient treatment shown in
`docs/superpowers/previews/navbar-mark-option-2.svg`:

- The lower pipeline shape runs from accent violet through the softer gradient violet to accent cyan.
- The upper trace runs from gradient violet through gradient fuchsia to gradient cyan.
- The two gradients share a direction and color family, but their different ranges keep the overlapping shapes legible.
- Retain the canvas-colored outline separating the shapes. Do not add glow, shadow, or animation.

## Implementation

Move the mark into a small inline React SVG component owned by the console layout. SVG gradient stops and the separating outline will reference the existing semantic CSS variables (`--accent-violet`, `--accent-cyan`, `--grad-from`, `--grad-via`, `--grad-to`, and `--canvas`). This lets one mark respond automatically to dark and light themes.

Replace the two theme-specific navbar images with this component. Remove the obsolete dark/light mark assets and their global visibility selectors after confirming they have no other consumers. Keep the existing accessible brand-link text; the mark remains decorative with `aria-hidden`.

## Scope

This change only affects the console navbar brand mark. Its geometry, dimensions, navbar spacing, wordmark typography, navigation, and interaction remain unchanged.

## Verification

- Update the console layout test to expect one decorative inline SVG instead of two theme-switched images.
- Confirm the SVG uses semantic theme variables rather than fixed palette values.
- Visually check the navbar at its actual size in dark and light themes.
- Run `npm run verify` from `frontend/` and `make format-check-frontend` from the repository root.

