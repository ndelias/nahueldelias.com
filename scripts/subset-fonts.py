#!/usr/bin/env python3
"""Subset the self-hosted fonts to the characters the site sets.

Source: docs/design/reference/fonts (the @fontsource Latin subsets, OFL).
Output: src/assets/fonts, same names. The @font-face unicode-range in
src/styles/base.css must list the same set (UNICODES below).

Why: at the full Latin subset the three files are 48.9KB and put the homepage
LCP over its 1.2s budget in the simulated mobile run; subset they're 29.5KB
and it lands at 1.05s. Kept: Basic Latin, typographic punctuation, the
multiplication sign, and Spanish letters. Anything else falls back per
character to the metric-matched fallback (src/styles/fallbacks.css).

Needs fontTools with brotli, a local tool, not a site dependency:
    python3 -m venv .venv && .venv/bin/pip install fonttools brotli
    .venv/bin/python scripts/subset-fonts.py
Then re-run scripts/font-metrics.mjs.
"""

from pathlib import Path

from fontTools import subset

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "docs/design/reference/fonts"
OUTPUT = ROOT / "src/assets/fonts"

UNICODES = (
    "U+0020-007E,"  # Basic Latin
    "U+00A0,U+00A1,U+00B7,U+00BF,U+00D7,"  # nbsp ¡ · ¿ ×
    "U+00C1,U+00C9,U+00CD,U+00D1,U+00D3,U+00DA,U+00DC,"  # Á É Í Ñ Ó Ú Ü
    "U+00E1,U+00E9,U+00ED,U+00F1,U+00F3,U+00FA,U+00FC,"  # á é í ñ ó ú ü
    "U+2013-2014,U+2018-2019,U+201C-201D,U+2026"  # – — ‘ ’ “ ” …
)

# Kerning, ligatures, tabular/proportional figures, fractions. Mark
# positioning isn't needed: every kept accented letter is precomposed.
FEATURES = "kern,liga,locl,tnum,pnum,frac"

for source in sorted(SOURCE.glob("*.woff2")):
    target = OUTPUT / source.name
    subset.main([
        str(source),
        f"--unicodes={UNICODES}",
        f"--layout-features={FEATURES}",
        "--no-hinting",
        "--flavor=woff2",
        f"--output-file={target}",
    ])
    print(f"{source.name}: {source.stat().st_size:,} -> {target.stat().st_size:,} bytes")
