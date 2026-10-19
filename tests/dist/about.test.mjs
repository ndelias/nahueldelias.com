// /about, in Chrome against the shipped build (dist/): the meadow, the steps
// branching out and back into the portrait, the thread down the experience
// to the close, and the links. Readable without JS; complete at once under
// reduced motion.

import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { launch, serve } from '../../scripts/lib/browser.mjs';

const DIST = join(resolve(import.meta.dirname, '../..'), 'dist');
const DESKTOP = { width: 1440, height: 900 };

let server;
let browser;
before(async () => {
  assert.ok(existsSync(join(DIST, 'about/index.html')), 'No dist/about/. Run `npm run build` first.');
  server = await serve(DIST);
  browser = await launch();
});
after(async () => {
  await browser?.close();
  await server?.close();
});

async function open(options = {}) {
  const ctx = await browser.newContext({ viewport: DESKTOP, ...options });
  const page = await ctx.newPage();
  await page.goto(server.origin + '/about/', { waitUntil: 'load' });
  return { ctx, page };
}
// How many pixels a canvas has drawn (any alpha).
const inked = (page, selector) =>
  page.evaluate((s) => {
    const c = document.querySelector(s);
    if (!c.width || !c.height) return 0;
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i]) n++;
    return n;
  }, selector);

test('no placeholder copy; About is in the nav on every page', async () => {
  const html = await readFile(join(DIST, 'about/index.html'), 'utf8');
  assert.ok(!/\[[A-Z][^\]]*\]/.test(html.replace(/<[^>]+>/g, ' ')), 'bracketed placeholder text on /about');
  for (const page of ['index.html', 'work/vers1ons/index.html']) {
    const other = await readFile(join(DIST, page), 'utf8');
    assert.match(other, /<a href="\/about"/, `no About link on ${page}`);
  }
});

test('without JS: the steps, the statement, the experience and the links read plainly; no empty portrait', async () => {
  const { ctx, page } = await open({ javaScriptEnabled: false });
  const state = await page.evaluate(() => ({
    h1: document.querySelector('h1').textContent.trim(),
    steps: [...document.querySelectorAll('[data-steps] li')].filter((li) => li.checkVisibility({ opacityProperty: true })).length,
    statement: document.querySelector('[data-statement]').checkVisibility(),
    roles: document.querySelectorAll('[data-exp] .rows li').length,
    links: [...document.querySelectorAll('[data-reach] a')].map((a) => a.getAttribute('href')),
    portrait: document.querySelector('[data-portrait]').checkVisibility(),
  }));
  assert.deepEqual(state, {
    h1: 'This is how I think about product.',
    steps: 5,
    statement: true,
    roles: 6,
    links: ['/nahuel-delias-resume.pdf', '/nahuel-delias-resume.pdf', 'https://www.linkedin.com/in/nahuel-d-elias', 'mailto:njdelias@gmail.com', 'https://github.com/ndelias'],
    portrait: false,
  });
  await ctx.close();
});

test('the meadow is drawn after the first paint', async () => {
  const { ctx, page } = await open();
  await page.waitForFunction(() => document.querySelector('[data-meadow][data-ready]'));
  assert.ok((await inked(page, '[data-meadow]')) > 1000, 'the meadow is empty');
  await ctx.close();
});

test('scrolling: the steps show as their lines reach them, the portrait settles, the thread ends in an arrow at the close', async () => {
  const { ctx, page } = await open();
  await page.waitForFunction(() => document.querySelector('[data-tree][data-ready]'));
  assert.equal(await page.locator('[data-steps] li.in').count(), 0, 'steps showing before the reader reaches them');
  await page.evaluate(() => document.querySelector('[data-portrait]').scrollIntoView({ block: 'start' }));
  await page.waitForFunction(() => document.querySelectorAll('[data-steps] li.in').length === 5);
  assert.ok((await inked(page, '[data-portrait]')) > 2000, 'the portrait is empty');
  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForFunction(() => document.querySelector('[data-thread] polyline')?.style.opacity === '');
  await ctx.close();
});

test('reduced motion: everything is in place at once, the meadow still', async () => {
  const { ctx, page } = await open({ reducedMotion: 'reduce' });
  await page.waitForFunction(() => document.querySelector('[data-tree][data-ready]'));
  assert.equal(await page.locator('[data-steps] li.in').count(), 5);
  assert.ok((await inked(page, '[data-portrait]')) > 2000, 'the portrait is not drawn');
  const still = await page.evaluate(async () => {
    const c = document.querySelector('[data-meadow]');
    const a = c.toDataURL();
    await new Promise((r) => setTimeout(r, 600));
    return a === c.toDataURL();
  });
  assert.ok(still, 'the meadow moves under reduced motion');
  await ctx.close();
});

test('the résumé opens in a new tab and downloads; it is served as a PDF', async () => {
  const { ctx, page } = await open();
  const links = await page.evaluate(() =>
    [...document.querySelectorAll('[data-reach] a[href$=".pdf"]')].map((a) => ({ target: a.target, download: a.hasAttribute('download') })),
  );
  assert.deepEqual(links, [
    { target: '_blank', download: false },
    { target: '', download: true },
  ]);
  const res = await page.request.get(server.origin + '/nahuel-delias-resume.pdf');
  assert.equal(res.status(), 200);
  assert.ok((await res.body()).subarray(0, 5).toString() === '%PDF-', 'not a PDF');
  await ctx.close();
});

test('phone: nothing runs off the side', async () => {
  const { ctx, page } = await open({ viewport: { width: 390, height: 844 } });
  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(300);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 390);
  await ctx.close();
});
