# Interface design notes

## Type
- **Display:** Bricolage Grotesque (headings, the wordmark, modal titles): `font-display`.
- **Interface:** IBM Plex Sans (everything else): `font-sans`.
- **Readouts:** IBM Plex Mono (dimensions, IDs, shortcuts, small labels): `font-mono`.
- All three are self-hosted through `@fontsource` packages, imported in `src/main.tsx`. Nothing is
  requested from a third-party font host, and the Content-Security-Policy does not allow one.

## Colour
Tokens live in `src/index.css` under `@theme`.
- **Neutrals** replace Tailwind `slate` with a teal-tinted grey ramp (drafting-table paper and ink).
- **One accent**, deep teal, replaces Tailwind `cyan`. From shade 600 up it passes WCAG AA as text on
  white and the canvas, and white text on `cyan-600` passes AA. `tests/unit/designTokens.test.ts`
  checks this, so a palette change that breaks contrast fails the build.
- Small text uses `slate-500` or darker. `slate-400` is for borders and icons only.
- Green, amber and rose are reserved for status (coverage, load, destructive actions).

## Components
- **Buttons** (`.av-btn`, `-primary`, `-secondary`, `-danger`, `-sm`): flat, 8 px radius, a 1 px border, no
  glow or lift. State is colour; press is a 1% scale.
- **Toolbar:** one row. View (3D / 2D), Light (Day / Evening / Night / Cutaway), a Tools menu (heatmap,
  relight, Gemini key, reset), House Designer, Share & Export.
- **Room labels** carry the name only. Area appears in the hover card, in m² and ft².
- Keyboard focus is always visible (`:focus-visible`), and `prefers-reduced-motion` turns animation off.

## Copy
Say what a control does, with real numbers: "Adds an access point to any room whose centre is more than
6.5 m from the nearest one", not "Auto-optimize". Call things by what people recognise ("Add a room"), not
how the system is built. No emoji as icons; use the lucide icons.

## Guardrail
`npm run audit:ui` runs `scripts/vibe_audit.py` (also in CI). It fails the build on emoji used as icons,
default indigo/purple gradients, neon glows and generic AI buzzwords. Findings are leads: confirm in context.
