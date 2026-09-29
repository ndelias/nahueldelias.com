# nahueldelias.com

Product engineering portfolio for Nahuel. The site is itself a portfolio piece:
read as evidence of craft, performance sense and taste.

- Full spec: docs/brief.md (sections referenced as §N below)
- Design reference: docs/design/reference/home.html opens standalone in any
  browser (URL options in reference/README.md). Baseline screenshots for
  Playwright comparisons are in docs/design/reference/screens/. The
  docs/design/*.dc.html files are the canvas sources and hold the exact
  values in their script blocks. All of these are fixed-1440px design mocks:
  port the values and behavior, not the markup.

## Stack
- Astro + MDX, content collections, deployed on Vercel.
- Styling: CSS custom properties for all tokens. No CSS framework unless asked.
- Interactivity: small vanilla TypeScript islands. React only for an island that
  clearly earns it (e.g. a chart in /data), never on `/`.

## Hard rules
- Budgets are CI gates and must fail the build (§6):
  JS on `/` < 100KB compressed (checked on every page) · LCP < 1.2s
  (mobile, throttled 4G) · CLS < 0.05 · Lighthouse ≥ 95 in all four
  categories (SEO skipped only on noindexed fixture pages) · WCAG AA
  contrast.
- HTML budget: every page's HTML < 13.6KB gzipped (scripts/check-html.mjs),
  about 20% above the largest page when set (Distribution, 11.4KB,
  2026-09-29). It includes the inline CSS, and first paint waits on it.
  Raise it deliberately, here and in the script, never to make a page fit.
- Image budgets (scripts/check-posters.mjs), AVIF: strip posters 40KB 1x /
  80KB 2x; case study heroes 60KB up to 1344w / 120KB at 2688w.
- Content schema rules must fail the build, not warn (§3):
  at most two `weight: 1` entries; `decision` required when weight ≤ 2;
  `hypothesis` required for section `data`; status badge rendered automatically.
- Sections render only when they have entries. No empty states, no "coming soon".
- Fonts: Instrument Sans 400/500 + DM Mono 400. Self-hosted, Latin subset
  (narrowed by scripts/subset-fonts.py to keep / inside the LCP budget),
  font-display: swap, preloaded. No other families.
- Symbols (← → ↗ ●) are not in the subset font files. Draw them as inline SVG
  (currentColor, sized to the text) rather than relying on a fallback font.
  The reference mock uses the system fallback; don't copy that.
- Respect prefers-reduced-motion everywhere. Visible focus states everywhere.
- No preloaders, no page transitions that delay content, no autoplaying sound.
- Ask before adding any dependency. Say what it's for and what it costs in KB.
- The sitemap (when added) excludes /_tokens and any fixture entries.

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
- Playwright comparisons load pages over HTTP (a local static server), never
  file://. Allow ~0.5% pixel difference: text-edge anti-aliasing alone
  differs by ~0.25% from the baselines.
- The site's own screenshots in tests/screens/ are a CI gate, exact to the
  pixel (the ~0.5% allowance is for comparisons with docs/design). When a
  render change is intended, push, run `npm run screens:update` and commit
  the new baselines with the change.
- Chrome is pinned. The screens, dist-tests and Lighthouse jobs run Chrome
  for Testing at the exact version in `.chrome-version` (installed by
  .github/actions/chrome, which fails if the binary reports anything else),
  on `ubuntu-24.04`. GitHub doesn't allow pinning the image build under that
  label; each job logs it ("Image: … Version: …") and the Chrome version
  goes in the job summary. To bump Chrome: edit `.chrome-version` → push →
  `npm run screens:update` → review the baseline diff → commit the version
  and baselines together.
- Never commit placeholder copy as if it were real: bracketed text like
  [Tagline] stays bracketed until Nahuel supplies it.
