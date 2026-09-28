// Every character on every built page must be in the font face that sets it.
// The fonts are subset (scripts/subset-fonts.py), so a character outside the
// subset would silently render in a fallback font. This loads each page over
// HTTP in Chrome, reads every text node (visually hidden and display: none
// text included) and ::before/::after content with the font-family, weight and
// text-transform it computes to, maps that to the face CSS font matching would pick, and
// checks the character against the face's cmap. Runs against dist/: build
// first.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { cmap, woff2Tables } from '../../scripts/lib/sfnt.mjs';
import { launch, serve } from '../../scripts/lib/browser.mjs';

const ROOT = resolve(import.meta.dirname, '../..');
const DIST = join(ROOT, 'dist');
const FONTS = join(ROOT, 'src/assets/fonts');

// The self-hosted faces, as declared in src/styles/base.css.
const FACES = [
  { family: 'Instrument Sans', weight: 400, file: 'instrument-sans-latin-400-normal.woff2' },
  { family: 'Instrument Sans', weight: 500, file: 'instrument-sans-latin-500-normal.woff2' },
  { family: 'DM Mono', weight: 400, file: 'dm-mono-latin-400-normal.woff2' },
];
// Families that only stand in while a webfont loads (src/styles/fallbacks.css).
const FALLBACK = / Fallback$/;
const VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 375, height: 800 },
];

/** CSS Fonts 4 weight matching, for the weights a family actually has. */
function matchWeight(wanted, available) {
  if (available.includes(wanted)) return wanted;
  const up = available.filter((w) => w > wanted).sort((a, b) => a - b);
  const down = available.filter((w) => w < wanted).sort((a, b) => b - a);
  if (wanted >= 400 && wanted <= 500) {
    const between = up.filter((w) => w <= 500);
    return between[0] ?? down[0] ?? up[0];
  }
  return wanted < 400 ? (down[0] ?? up[0]) : (up[0] ?? down[0]);
}

async function htmlPages(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await htmlPages(p)));
    else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
}

// Runs in the page: [{ text, family, weight, where }] for every text node in
// <body> and every string ::before/::after.
function collectText() {
  const out = [];
  const describe = (el) => el.tagName.toLowerCase() + (el.classList.length ? '.' + [...el.classList].filter((c) => !c.startsWith('astro-')).join('.') : '');
  const face = (cs) => ({ family: cs.fontFamily.split(',')[0].trim().replace(/^["']|["']$/g, ''), weight: Number(cs.fontWeight), transform: cs.textTransform });
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const el = node.parentElement;
    if (!el || el.closest('script, style, template, noscript')) continue;
    if (!node.data.trim()) continue;
    out.push({ text: node.data, ...face(getComputedStyle(el)), where: describe(el) });
  }
  for (const el of document.body.querySelectorAll('*')) {
    for (const pseudo of ['::before', '::after']) {
      const cs = getComputedStyle(el, pseudo);
      const m = cs.content.match(/^"(.*)"$/s);
      if (m && m[1].trim()) out.push({ text: m[1], ...face(cs), where: describe(el) + pseudo });
    }
  }
  return out;
}

test('every character on every built page is in the font face that sets it', { timeout: 120_000 }, async () => {
  assert.ok(existsSync(DIST), 'No dist/. Run `npm run build` first.');

  const faces = await Promise.all(
    FACES.map(async (f) => {
      const lookup = cmap(woff2Tables(await readFile(join(FONTS, f.file))).get('cmap'));
      return { ...f, has: (cp) => lookup(cp) !== 0 };
    }),
  );
  const families = new Map();
  for (const f of faces) families.set(f.family, [...(families.get(f.family) ?? []), f]);

  const pages = await htmlPages(DIST);
  assert.ok(pages.length > 0, 'No HTML pages in dist/.');

  const server = await serve(DIST);
  const browser = await launch();
  const problems = new Set();
  let checked = 0;
  try {
    for (const viewport of VIEWPORTS) {
      const page = await browser.newPage({ viewport });
      for (const file of pages) {
        const path = '/' + relative(DIST, file).replace(/index\.html$/, '').split('\\').join('/');
        await page.goto(server.origin + path, { waitUntil: 'load' });
        for (const { text, family, weight, transform, where } of await page.evaluate(collectText)) {
          if (FALLBACK.test(family)) continue;
          const available = families.get(family);
          if (!available) {
            problems.add(`${path} ${where}: font-family "${family}" isn't self-hosted ("${text.trim().slice(0, 30)}")`);
            continue;
          }
          const w = matchWeight(weight, available.map((f) => f.weight));
          const f = available.find((x) => x.weight === w);
          // What renders is the transformed text ("é" in an uppercase label sets "É").
          const shown = transform === 'uppercase' ? text.toUpperCase() : transform === 'lowercase' ? text.toLowerCase() : text;
          for (const ch of new Set([...text, ...shown])) {
            if (/\s/.test(ch)) continue;
            checked++;
            const cp = ch.codePointAt(0);
            if (!f.has(cp)) {
              const code = 'U+' + cp.toString(16).toUpperCase().padStart(4, '0');
              problems.add(`${path} ${where}: "${ch}" ${code} is not in ${f.family} ${f.weight}`);
            }
          }
        }
      }
      await page.close();
    }
  } finally {
    await browser.close();
    await server.close();
  }
  assert.ok(checked > 0, 'Checked no characters: the page walk found no text.');
  assert.equal(problems.size, 0, `Characters outside the subset fonts:\n  ${[...problems].join('\n  ')}`);
});
