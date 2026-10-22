// The About page, the homepage (/), in Chrome against the shipped build
// (dist/): the meadow and its arrival, the steps branching out and back into
// the portrait, My work, the thread down the experience to the close, and
// the links. Readable without JS; complete at once under reduced motion.
// /about redirects here.

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
  assert.ok(existsSync(join(DIST, 'work/index.html')), 'No dist/work/. Run `npm run build` first.');
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
  await page.goto(server.origin + '/', { waitUntil: 'load' });
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

test('no placeholder copy; Work and About in the nav on every page; /about lands here', async () => {
  const html = await readFile(join(DIST, 'index.html'), 'utf8');
  assert.ok(!/\[[A-Z][^\]]*\]/.test(html.replace(/<[^>]+>/g, ' ')), 'bracketed placeholder text on /');
  for (const page of ['index.html', 'work/index.html', 'work/vers1ons/index.html', 'studies/bespoke/index.html']) {
    const other = await readFile(join(DIST, page), 'utf8');
    assert.match(other, /<a href="\/work"/, `no Work link on ${page}`);
    assert.match(other, /<a href="\/"/, `no About link on ${page}`);
  }
  const redirect = await readFile(join(DIST, 'about/index.html'), 'utf8');
  assert.match(redirect, /http-equiv="refresh" content="0;url=\/"/);
});

test('the name in the corner leads home; /work carries the resume and Contact, small, bottom right', async () => {
  for (const page of ['index.html', 'work/index.html', 'work/vers1ons/index.html']) {
    const html = await readFile(join(DIST, page), 'utf8');
    assert.match(html, /<a class="name[^"]*"[^>]*href="\/"/, `the name doesn't lead home on ${page}`);
  }
  const work = await readFile(join(DIST, 'work/index.html'), 'utf8');
  const corner = work.match(/<div class="contact[^"]*"[^>]*>([\s\S]*?)<\/div>/)?.[1] ?? '';
  assert.match(corner, /href="\/nahuel-delias-resume\.pdf" target="_blank"/);
  assert.match(corner, /href="mailto:njdelias@gmail\.com"/);
  const hub = await readFile(join(DIST, 'work/vers1ons/index.html'), 'utf8');
  assert.ok(!/class="contact[ "]/.test(hub), 'the corner links show off /work');
});

test('My work: a card for every project, in order, each to its page; then All work', async () => {
  const { ctx, page } = await open({ javaScriptEnabled: false });
  const work = await page.evaluate(() => ({
    cards: [...document.querySelectorAll('[data-work] .card a')].map((a) => [a.querySelector('.card-title').textContent.trim(), a.getAttribute('href')]),
    all: document.querySelector('[data-work] .all').getAttribute('href'),
  }));
  assert.deepEqual(work, {
    cards: [
      ['vers1ons', '/work/vers1ons/'],
      ['Vera', '/work/vera/'],
      ['Bespoke', '/studies/bespoke/'],
    ],
    all: '/work',
  });
  await ctx.close();
});

test('My work: pointing at a card plays its recording over the cover, muted; leaving stops it', async () => {
  const { ctx, page } = await open();
  // The real recordings: a stand-in that fails to play would be dropped, as
  // a broken one is.
  await page.waitForFunction(() => document.querySelector('[data-tree][data-ready]'));
  assert.equal(await page.locator('[data-work] video').count(), 0, 'a recording before anything was pointed at');
  const cards = page.locator('[data-work] .card a');
  for (const [i, src] of ['/media/vers1ons/reel.mp4', '/media/vera/reel.mp4', '/media/bespoke/v2-flow.mp4'].entries()) {
    await cards.nth(i).hover();
    const state = await page.evaluate(() => {
      const v = document.querySelector('[data-work] video');
      return v && { src: new URL(v.src).pathname, muted: v.muted, inCover: !!v.closest('.cover') };
    });
    assert.deepEqual(state, { src, muted: true, inCover: true });
  }
  await page.mouse.move(5, 5);
  assert.equal(await page.locator('[data-work] video').count(), 0, 'the recording stayed after the pointer left');
  await ctx.close();
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

test('the meadow arrives in pixels after the first paint, then is whole', async () => {
  const { ctx, page } = await open();
  // Sized by the script (a canvas starts at 300 wide), then filling in.
  await page.waitForFunction(() => document.querySelector('[data-meadow]').width !== 300);
  const during = await inked(page, '[data-meadow]');
  await page.waitForFunction(() => document.querySelector('[data-meadow][data-ready]'));
  const whole = await page.evaluate(() => document.querySelector('[data-meadow]').width * document.querySelector('[data-meadow]').height);
  const after = await inked(page, '[data-meadow]');
  assert.ok(during < whole * 0.9, `the meadow was already whole as it arrived (${during} of ${whole})`);
  assert.equal(after, whole, 'the meadow has holes once it has arrived');
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

test('the resume opens in a new tab and downloads; it is served as a PDF', async () => {
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
