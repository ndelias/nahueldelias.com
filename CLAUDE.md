# nahueldelias.com

Product engineering portfolio for Nahuel. The site is itself a portfolio piece:
read as evidence of craft, performance sense and taste.

- Full spec: docs/brief.md (sections referenced as §N below)
- Design reference: docs/design/*.dc.html. Colors, type sizes, frame sizes,
  spacing and easing in these files are exact. They are design mocks at a fixed
  1440px width, not production code: port the values, not the markup.

## Stack
- Astro + MDX, content collections, deployed on Vercel.
- Styling: CSS custom properties for all tokens. No CSS framework unless asked.
- Interactivity: small vanilla TypeScript islands. React only for an island that
  clearly earns it (e.g. a chart in /data), never on `/`.

## Hard rules
- Budgets are CI gates and must fail the build (§6):
  JS on `/` < 100KB compressed · LCP < 1.2s (mobile, throttled 4G) ·
  CLS < 0.05 · Lighthouse ≥ 95 in all four categories · WCAG AA contrast.
- Content schema rules must fail the build, not warn (§3):
  at most two `weight: 1` entries; `decision` required when weight ≤ 2;
  `hypothesis` required for section `data`; status badge rendered automatically.
- Sections render only when they have entries. No empty states, no "coming soon".
- Fonts: Instrument Sans 400/500 + DM Mono 400. Self-hosted, Latin subset,
  font-display: swap, preloaded. No other families.
- Respect prefers-reduced-motion everywhere. Visible focus states everywhere.
- No preloaders, no page transitions that delay content, no autoplaying sound.
- Ask before adding any dependency. Say what it's for and what it costs in KB.

## Tokens (light / dark)
bg #F2F1ED / #161513 · surface #E8E6E0 / #211F1C · line #D3D0C8 / #34312C
muted #67645E / #9A968E · ink #1B1A18 / #EDEBE6 · accent #2447F0 / #7D93FF
Accent is only for links, focus rings and the Concept badge.
Easing for strip motion: cubic-bezier(0.2, 0.7, 0.2, 1).

## Working agreement
- One §9 step per session. Plan first, list files you'll touch.
- After each working step: run the build and CI checks locally, commit with a
  clear message, and add a dated MDX entry in src/content/log/.
- Verify UI against docs/design with Playwright screenshots, not by eye.
- Never commit placeholder copy as if it were real: bracketed text like
  [Tagline] stays bracketed until Nahuel supplies it.
