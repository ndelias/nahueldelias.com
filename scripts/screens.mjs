#!/usr/bin/env node
// Screenshots of the site, always over HTTP (never file://). Two kinds:
//
// Site baselines, a gate. Committed screenshots of the built pages themselves
// (tests/screens/): / in both views, and case study pages full length,
// captured in CI. Any change to how the page renders has to
// show up as a changed baseline in the PR diff.
//
//   node scripts/screens.mjs site [outDir]
//     Captures the built / (dist/) into outDir (default .screens/site).
//   node scripts/screens.mjs check [outDir]
//     Captures, then compares each shot with its baseline, pixel for pixel.
//     Exits 1 when any pixel differs in any channel, or a shot has no
//     baseline yet. CI renders deterministically (the same Chrome, fonts and
//     page every run), so there's no tolerance. Diff images go next to the
//     captures.
//   npm run screens:update
//     Regenerates the baselines from CI (scripts/screens-update.mjs).
//
// Design reference, a report. / against the mock's screenshots
// (docs/design/reference/screens/), with a per-region breakdown, since the
// page differs from the mock on purpose in places. Case study pages against
// their canvas mocks, rendered live by docs/design/reference/dc.html, block
// by block (the page is longer than the fixed-height mock, so blocks are
// matched by element, not by position).
//
//   node scripts/screens.mjs capture [outDir]
//     Renders docs/design/reference/home.html into its baselines, default
//     docs/design/reference/screens. Captured in CI, like the site's.
//   node scripts/screens.mjs mock [outDir]
//     Compares the built / with the mock's screenshots. Writes captures, diff
//     images and report.md (a markdown table) to outDir (default .screens/mock).
//
// All at 1x. For the mock report, a pixel differs when any channel differs
// by more than 24 (of 255), which ignores sub-perceptual rounding, and 0.5%
// of pixels is the mark it's read against.

import { mkdir, readFile, writeFile, appendFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { launch, serve } from './lib/browser.mjs';

const ROOT = resolve(import.meta.dirname, '..');
const REFERENCE = join(ROOT, 'docs/design/reference');
const MOCK_BASELINES = join(REFERENCE, 'screens');
const SITE_BASELINES = join(ROOT, 'tests/screens');
const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };
// The site gate: exact.
const SITE_CHANNEL = 0;
const SITE_TOLERANCE = 0; // pixels
// The mock report.
const MOCK_TOLERANCE = 0.5; // percent of pixels
const MOCK_CHANNEL = 24;

// Mock baseline name → home.html URL options (see reference/README.md).
const CAPTURES = {
  'home-light-w01': '?still=1&active=0',
  'home-light-s02': '?still=1&active=3',
  'home-dark-w01': '?still=1&active=0&theme=dark',
  'home-light-index': '?still=1&view=index',
  'home-dark-index': '?still=1&view=index&theme=dark',
};

// The site's committed baselines. `view` is the homepage view to show;
// `next` presses Next that many times first.
const SITE = [
  { name: 'home-index-1440-light', viewport: DESKTOP, colorScheme: 'light', view: 'index' },
  { name: 'home-index-1440-dark', viewport: DESKTOP, colorScheme: 'dark', view: 'index' },
  { name: 'home-index-390-light', viewport: PHONE, colorScheme: 'light', view: 'index' },
  { name: 'home-index-390-dark', viewport: PHONE, colorScheme: 'dark', view: 'index' },
  // W01 focused, at rest. There's no video yet, so the frame is already a still.
  { name: 'home-strip-1440-light', viewport: DESKTOP, colorScheme: 'light', view: 'strip' },
  { name: 'home-strip-1440-dark', viewport: DESKTOP, colorScheme: 'dark', view: 'strip' },
  { name: 'home-strip-390-light', viewport: PHONE, colorScheme: 'light', view: 'strip' },
  { name: 'home-strip-390-dark', viewport: PHONE, colorScheme: 'dark', view: 'strip' },
  // Case studies, full length.
  { name: 'hub-1440-light', viewport: DESKTOP, colorScheme: 'light', path: '/work/vers1ons/' },
  { name: 'hub-1440-dark', viewport: DESKTOP, colorScheme: 'dark', path: '/work/vers1ons/' },
  { name: 'hub-390-light', viewport: PHONE, colorScheme: 'light', path: '/work/vers1ons/' },
  { name: 'hub-390-dark', viewport: PHONE, colorScheme: 'dark', path: '/work/vers1ons/' },
];

// Case study pages against their canvas mocks, block by block: [name, site
// selector, mock selector]. "Top" is the first screen.
const CASE_MOCKS = [
  {
    name: 'hub',
    path: '/work/vers1ons/',
    mock: 'CaseStudy',
    blocks: [
      ['Header', '[data-entry-header] .inner', 'section:first-of-type > div'],
      ['Meta row', 'dl.facts', 'dl'],
      ['Hero', '.hero figure', 'figure'],
      ['Decision', 'section.decision', 'section[aria-label="Decision"]'],
      ['Body', 'article.body', 'article'],
      ['Parts', 'section.parts', 'section[aria-label="Parts of vers1ons"]'],
      ['Versions', 'section.versions', 'section[aria-label="Versions"]'],
      ['Next', 'a.next', 'a[style*="margin-top: 160px"]'],
    ],
  },
];

// Regions of the 1440×900 mock, for the report's breakdown. A pixel counts
// toward the first region that contains it; everything else is "Rest".
const REGIONS = {
  index: [
    { name: 'Header', x: 0, y: 0, w: 1440, h: 70 },
    { name: 'List', x: 0, y: 140, w: 1000, h: 480 },
    { name: 'Preview', x: 1000, y: 140, w: 440, h: 480 },
    { name: 'Footer', x: 0, y: 830, w: 1440, h: 70 },
  ],
  strip: [
    { name: 'Header', x: 0, y: 0, w: 1440, h: 70 },
    { name: 'Meta', x: 440, y: 110, w: 560, h: 170 },
    { name: 'Strip', x: 0, y: 280, w: 1440, h: 340 },
    { name: 'Below strip', x: 0, y: 620, w: 1440, h: 60 },
    { name: 'Footer', x: 0, y: 830, w: 1440, h: 70 },
  ],
};
const MOCK = [
  { baseline: 'home-light-w01', colorScheme: 'light', view: 'strip' },
  { baseline: 'home-dark-w01', colorScheme: 'dark', view: 'strip' },
  { baseline: 'home-light-s02', colorScheme: 'light', view: 'strip', next: 3 },
  { baseline: 'home-light-index', colorScheme: 'light', view: 'index' },
  { baseline: 'home-dark-index', colorScheme: 'dark', view: 'index' },
];

const [mode, ...rest] = process.argv.slice(2);
const outArg = rest.find((a) => !a.startsWith('--'));

async function settle(page) {
  await page.evaluate(() => document.fonts.ready);
  // Strip transitions run up to ~0.65s.
  await page.waitForTimeout(1000);
}

// Full-length shots: load every lazy image first, or the shot has holes.
async function loadAll(page) {
  await page.evaluate(async () => {
    const imgs = [...document.images];
    for (const img of imgs) img.loading = 'eager';
    await Promise.all(imgs.map((img) => (img.complete ? null : img.decode().catch(() => {}))));
  });
}

/** Load a page in a fresh context and put it in the given state. */
async function shoot(browser, origin, { viewport, colorScheme, view, next = 0, path }) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, colorScheme });
  const page = await ctx.newPage();
  await page.goto(`${origin}${path ?? '/'}`, { waitUntil: 'load' });
  await settle(page);
  if (path) {
    await loadAll(page);
    await settle(page);
    const png = await page.screenshot({ fullPage: true });
    await ctx.close();
    return png;
  }
  // Clicked from script, not the mouse: no hover or focus ring in the shot.
  const ok = await page.evaluate(
    ([view, next]) => {
      const toggle = document.querySelector('[data-view-toggle]');
      const visible = (el) => el && el.checkVisibility();
      if (visible(toggle) && toggle.dataset.view !== view) toggle.click();
      if (next) {
        const button = document.querySelector('[data-strip-next]');
        if (!visible(button)) return false;
        for (let i = 0; i < next; i++) button.click();
      }
      // Without a visible toggle the page only has the Index view.
      return view === 'index' || visible(toggle);
    },
    [view, next],
  );
  if (!ok) throw new Error(`The page has no ${view} view with ${next} Next presses at ${viewport.width}px`);
  await settle(page);
  const png = await page.screenshot();
  await ctx.close();
  return png;
}

// Runs in the page: compares two PNGs (base64) and returns the count of
// differing pixels, per region too, and a diff image (differences red, the
// rest dimmed).
async function diffInPage([a, b, channel, regions, crop = false]) {
  const load = async (d) => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + d;
    await img.decode();
    const c = new OffscreenCanvas(img.width, img.height);
    const x = c.getContext('2d');
    x.drawImage(img, 0, 0);
    return x.getImageData(0, 0, img.width, img.height);
  };
  let A = await load(a), B = await load(b);
  const size = `${A.width}×${A.height} vs ${B.width}×${B.height}`;
  if (A.width !== B.width || A.height !== B.height) {
    if (!crop) return { error: `size ${size}` };
    // Blocks matched by element: compare the common top-left area.
    const w = Math.min(A.width, B.width), h = Math.min(A.height, B.height);
    const cut = (I) => {
      const c = new OffscreenCanvas(I.width, I.height);
      c.getContext('2d').putImageData(I, 0, 0);
      return c.getContext('2d').getImageData(0, 0, w, h);
    };
    A = cut(A);
    B = cut(B);
  }
  const out = new ImageData(A.width, A.height);
  const counts = regions.map((r) => ({ name: r.name, differ: 0, total: 0 }));
  const restCount = { name: 'Rest', differ: 0, total: 0 };
  let differ = 0;
  for (let i = 0; i < A.data.length; i += 4) {
    const d = Math.max(Math.abs(A.data[i] - B.data[i]), Math.abs(A.data[i + 1] - B.data[i + 1]), Math.abs(A.data[i + 2] - B.data[i + 2]));
    const bad = d > channel;
    if (bad) differ++;
    if (regions.length) {
      const p = i / 4, px = p % A.width, py = (p - px) / A.width;
      const k = regions.findIndex((r) => px >= r.x && px < r.x + r.w && py >= r.y && py < r.y + r.h);
      const c = k < 0 ? restCount : counts[k];
      c.total++;
      if (bad) c.differ++;
    }
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
  return { differ, total: A.width * A.height, size, regions: regions.length ? [...counts, restCount] : [], png: btoa(bin) };
}

const pct = (n, of) => (of ? (n / of) * 100 : 0).toFixed(2) + '%';

async function summary(title, text) {
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, `### ${title}\n\n${text}\n`);
}

/** Capture every site shot into `out`. Returns [{ name, png }]. */
async function captureSite(browser, out) {
  await mkdir(out, { recursive: true });
  const server = await serve(join(ROOT, 'dist'));
  const shots = [];
  try {
    for (const shot of SITE) {
      const png = await shoot(browser, server.origin, shot);
      await writeFile(join(out, `${shot.name}.png`), png);
      shots.push({ name: shot.name, png });
      console.log(`captured ${shot.name}.png`);
    }
  } finally {
    await server.close();
  }
  return shots;
}

const browser = await launch();
try {
  if (mode === 'capture') {
    const out = resolve(outArg ?? MOCK_BASELINES);
    await mkdir(out, { recursive: true });
    const server = await serve(REFERENCE);
    const page = await browser.newPage({ viewport: DESKTOP, deviceScaleFactor: 1 });
    for (const [name, query] of Object.entries(CAPTURES)) {
      await page.goto(`${server.origin}/home.html${query}`, { waitUntil: 'load' });
      await settle(page);
      await page.screenshot({ path: join(out, `${name}.png`) });
      console.log(`captured ${name}.png`);
    }
    await server.close();
  } else if (mode === 'site') {
    await captureSite(browser, resolve(outArg ?? join(ROOT, '.screens/site')));
  } else if (mode === 'check') {
    const out = resolve(outArg ?? join(ROOT, '.screens/site'));
    const shots = await captureSite(browser, out);
    const differ = await browser.newPage();
    const lines = [];
    let fail = false;
    for (const { name, png } of shots) {
      const file = join(SITE_BASELINES, `${name}.png`);
      if (!existsSync(file)) {
        fail = true;
        lines.push(`MISSING ${name}: no baseline in tests/screens/`);
        continue;
      }
      const r = await differ.evaluate(diffInPage, [png.toString('base64'), (await readFile(file)).toString('base64'), SITE_CHANNEL, []]);
      if (r.error) {
        fail = true;
        lines.push(`OVER    ${name}: ${r.error}`);
        continue;
      }
      await writeFile(join(out, `${name}.diff.png`), Buffer.from(r.png, 'base64'));
      const ok = r.differ <= SITE_TOLERANCE;
      fail ||= !ok;
      lines.push(`${ok ? 'same   ' : 'DIFFERS'} ${name}: ${r.differ} px differ (${pct(r.differ, r.total)})`);
    }
    if (fail) lines.push('', 'The page renders differently from its committed baselines. If the change is intended, run `npm run screens:update` and commit tests/screens/.');
    console.log(lines.join('\n'));
    await summary('Screens vs site baselines', '```\n' + lines.join('\n') + '\n```');
    if (fail) process.exitCode = 1;
  } else if (mode === 'mock') {
    const out = resolve(outArg ?? join(ROOT, '.screens/mock'));
    await mkdir(out, { recursive: true });
    const server = await serve(join(ROOT, 'dist'));
    const differ = await browser.newPage();
    const rows = [];
    const details = [];
    for (const m of MOCK) {
      const png = await shoot(browser, server.origin, { viewport: DESKTOP, ...m });
      await writeFile(join(out, `${m.baseline}.actual.png`), png);
      const base = await readFile(join(MOCK_BASELINES, `${m.baseline}.png`));
      const r = await differ.evaluate(diffInPage, [png.toString('base64'), base.toString('base64'), MOCK_CHANNEL, REGIONS[m.view]]);
      if (r.error) throw new Error(`${m.baseline}: ${r.error}`);
      await writeFile(join(out, `${m.baseline}.diff.png`), Buffer.from(r.png, 'base64'));
      rows.push(`| ${m.baseline} | ${pct(r.differ, r.total)} | ${r.differ} |`);
      details.push(
        `**${m.baseline}**\n\n| Region | Differs (of region) | Share of page |\n| --- | ---: | ---: |\n` +
          r.regions.map((g) => `| ${g.name} | ${pct(g.differ, g.total)} | ${pct(g.differ, r.total)} |`).join('\n'),
      );
    }
    await server.close();

    // Case studies against their canvas mocks, block by block.
    const caseRows = [];
    const site = await serve(join(ROOT, 'dist'));
    const design = await serve(join(ROOT, 'docs/design'));
    try {
      for (const c of CASE_MOCKS) {
        for (const colorScheme of ['light', 'dark']) {
          const ctx = await browser.newContext({ viewport: DESKTOP, deviceScaleFactor: 1, colorScheme });
          const page = await ctx.newPage();
          await page.goto(`${site.origin}${c.path}`, { waitUntil: 'load' });
          await settle(page);
          await loadAll(page);
          const mock = await ctx.newPage();
          await mock.goto(`${design.origin}/reference/dc.html?mock=${c.mock}${colorScheme === 'dark' ? '&theme=dark' : ''}`);
          await mock.waitForSelector('[data-ready]');
          await settle(mock);
          for (const [name, siteSel, mockSel] of c.blocks) {
            const file = `${c.name}-${colorScheme}-${name.toLowerCase().replace(/\W+/g, '-')}`;
            const a = page.locator(siteSel).first();
            const b = mock.locator(`#root ${mockSel}`).first();
            if (!(await a.count()) || !(await b.count())) {
              caseRows.push(`| ${c.name} · ${colorScheme} | ${name} | missing | ${(await a.count()) ? '' : 'site'} ${(await b.count()) ? '' : 'mock'} |`);
              continue;
            }
            const [pa, pb] = [await a.screenshot(), await b.screenshot()];
            await writeFile(join(out, `${file}.actual.png`), pa);
            await writeFile(join(out, `${file}.mock.png`), pb);
            const r = await differ.evaluate(diffInPage, [pa.toString('base64'), pb.toString('base64'), MOCK_CHANNEL, [], true]);
            await writeFile(join(out, `${file}.diff.png`), Buffer.from(r.png, 'base64'));
            caseRows.push(`| ${c.name} · ${colorScheme} | ${name} | ${pct(r.differ, r.total)} | ${r.size} |`);
          }
          await ctx.close();
        }
      }
    } finally {
      await site.close();
      await design.close();
    }

    const report = [
      '<!-- screens-mock -->',
      '### Homepage vs design reference (report, not a gate)',
      '',
      `Built \`/\` at 1440×900 against \`docs/design/reference/screens/\`. The page differs from the mock on purpose in places; the regions say where. Read against ${MOCK_TOLERANCE}% (a pixel counts when a channel differs by more than ${MOCK_CHANNEL}). The gate is the site's own baselines in \`tests/screens/\`, exact to the pixel.`,
      '',
      '| Mock screen | Differs | Pixels |',
      '| --- | ---: | ---: |',
      ...rows,
      '',
      ...details.flatMap((d) => [d, '']),
      '### Case studies vs their canvas mocks (report, not a gate)',
      '',
      'Each block of the page against the same block of the mock (docs/design/reference/dc.html), compared over their common area. Sizes are page vs mock.',
      '',
      '| Page | Block | Differs | Size |',
      '| --- | --- | ---: | --- |',
      ...caseRows,
      '',
    ].join('\n');
    await writeFile(join(out, 'report.md'), report);
    console.log(report);
    await summary('Screens vs design reference', report);
  } else {
    console.error('Usage: node scripts/screens.mjs site|check|mock|capture [outDir]');
    process.exitCode = 2;
  }
} finally {
  await browser.close();
}
