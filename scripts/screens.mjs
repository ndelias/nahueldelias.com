#!/usr/bin/env node
// Design reference screenshots, always over HTTP (never file://).
//
//   node scripts/screens.mjs capture [outDir]
//     Renders docs/design/reference/home.html into the baselines, default
//     docs/design/reference/screens. Baselines are captured in CI (the
//     `screens` job), so they match the environment comparisons run in.
//
//   node scripts/screens.mjs compare [outDir] [--strict]
//     Renders the built / (dist/) with JS off, which is the full no-JS page,
//     against the (Index) baselines. Writes each screenshot and a diff image
//     to outDir (default .screens/) and reports the share of differing pixels
//     against a 0.5% tolerance. --strict exits 1 when over it.
//
// 1440×900 at 1x. A pixel differs when any channel differs by more than 24
// (of 255), which ignores sub-perceptual rounding.

import { mkdir, readFile, writeFile, appendFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { launch, serve } from './lib/browser.mjs';

const ROOT = resolve(import.meta.dirname, '..');
const REFERENCE = join(ROOT, 'docs/design/reference');
const BASELINES = join(REFERENCE, 'screens');
const VIEWPORT = { width: 1440, height: 900 };
const TOLERANCE = 0.5; // percent of pixels
const CHANNEL = 24;

// Baseline name → home.html URL options (see reference/README.md).
const CAPTURES = {
  'home-light-w01': '?still=1&active=0',
  'home-light-s02': '?still=1&active=3',
  'home-dark-w01': '?still=1&active=0&theme=dark',
  'home-light-index': '?still=1&view=index',
  'home-dark-index': '?still=1&view=index&theme=dark',
};
const COMPARISONS = [
  { baseline: 'home-light-index', colorScheme: 'light' },
  { baseline: 'home-dark-index', colorScheme: 'dark' },
];

const [mode, ...rest] = process.argv.slice(2);
const strict = rest.includes('--strict');
const outArg = rest.find((a) => !a.startsWith('--'));

async function settle(page) {
  await page.evaluate(() => document.fonts.ready);
  // Strip transitions in the reference run up to ~0.65s.
  await page.waitForTimeout(1000);
}

// Runs in the page: compares two PNGs (base64) and returns the count of
// differing pixels and a diff image (differences red, the rest dimmed).
async function diffInPage([a, b, channel]) {
  const load = async (d) => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + d;
    await img.decode();
    const c = new OffscreenCanvas(img.width, img.height);
    const x = c.getContext('2d');
    x.drawImage(img, 0, 0);
    return x.getImageData(0, 0, img.width, img.height);
  };
  const A = await load(a), B = await load(b);
  if (A.width !== B.width || A.height !== B.height) return { error: `size ${A.width}×${A.height} vs ${B.width}×${B.height}` };
  const out = new ImageData(A.width, A.height);
  let differ = 0;
  for (let i = 0; i < A.data.length; i += 4) {
    const d = Math.max(Math.abs(A.data[i] - B.data[i]), Math.abs(A.data[i + 1] - B.data[i + 1]), Math.abs(A.data[i + 2] - B.data[i + 2]));
    const bad = d > channel;
    if (bad) differ++;
    out.data[i] = bad ? 255 : B.data[i] * 0.3;
    out.data[i + 1] = bad ? 0 : B.data[i + 1] * 0.3;
    out.data[i + 2] = bad ? 0 : B.data[i + 2] * 0.3;
    out.data[i + 3] = 255;
  }
  const c = new OffscreenCanvas(A.width, A.height);
  c.getContext('2d').putImageData(out, 0, 0);
  const bytes = new Uint8Array(await (await c.convertToBlob()).arrayBuffer());
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return { differ, total: A.width * A.height, png: btoa(bin) };
}

const browser = await launch();
try {
  if (mode === 'capture') {
    const out = resolve(outArg ?? BASELINES);
    await mkdir(out, { recursive: true });
    const server = await serve(REFERENCE);
    const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: 1 });
    for (const [name, query] of Object.entries(CAPTURES)) {
      await page.goto(`${server.origin}/home.html${query}`, { waitUntil: 'load' });
      await settle(page);
      await page.screenshot({ path: join(out, `${name}.png`) });
      console.log(`captured ${name}.png`);
    }
    await server.close();
  } else if (mode === 'compare') {
    const out = resolve(outArg ?? join(ROOT, '.screens'));
    await mkdir(out, { recursive: true });
    const server = await serve(join(ROOT, 'dist'));
    const differ = await browser.newPage();
    const lines = [];
    let over = false;
    for (const { baseline, colorScheme } of COMPARISONS) {
      const ctx = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1, colorScheme, javaScriptEnabled: false });
      const page = await ctx.newPage();
      await page.goto(`${server.origin}/`, { waitUntil: 'load' });
      await settle(page);
      const shot = await page.screenshot();
      await ctx.close();
      await writeFile(join(out, `${baseline}.actual.png`), shot);
      const base = await readFile(join(BASELINES, `${baseline}.png`));
      const r = await differ.evaluate(diffInPage, [shot.toString('base64'), base.toString('base64'), CHANNEL]);
      if (r.error) throw new Error(`${baseline}: ${r.error}`);
      await writeFile(join(out, `${baseline}.diff.png`), Buffer.from(r.png, 'base64'));
      const pct = (r.differ / r.total) * 100;
      over ||= pct > TOLERANCE;
      lines.push(`${pct <= TOLERANCE ? 'within' : 'OVER  '}  ${baseline}: ${pct.toFixed(2)}% differ (${r.differ} px), tolerance ${TOLERANCE}%`);
    }
    await server.close();
    console.log(lines.join('\n'));
    if (process.env.GITHUB_STEP_SUMMARY) {
      await appendFile(process.env.GITHUB_STEP_SUMMARY, `### Screens vs design reference\n\n\`\`\`\n${lines.join('\n')}\n\`\`\`\n`);
    }
    if (strict && over) process.exitCode = 1;
  } else {
    console.error('Usage: node scripts/screens.mjs capture [outDir] | compare [outDir] [--strict]');
    process.exitCode = 2;
  }
} finally {
  await browser.close();
}
