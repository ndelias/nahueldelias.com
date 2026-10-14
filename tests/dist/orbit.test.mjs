// The homepage constellation's behaviour (§7.5), in Chrome against the built
// site: what exists with and without JS or motion, the row, opening a
// project (pointer, keyboard, tap), its parts, the caption, the video, the
// (Index) switch and the LCP poster. Runs against dist-fixtures/, the build
// with the fixture entries, so the row has eight projects (npm run
// build:fixtures). The shipped single project is in single.test.mjs.

import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { launch, serve } from '../../scripts/lib/browser.mjs';

const DIST = join(resolve(import.meta.dirname, '../..'), 'dist-fixtures');
const DESKTOP = { width: 1440, height: 900 };
const N = 8; // fixture entries
const PARTS = ['W01.1', 'W01.2', 'W01.3', 'W01.4', 'W01.5'];

let server;
let browser;
before(async () => {
  assert.ok(existsSync(DIST), 'No dist-fixtures/. Run `npm run build:fixtures` first.');
  server = await serve(DIST);
  browser = await launch();
});
after(async () => {
  await browser?.close();
  await server?.close();
});

// The tests give the recordings: a clip recorded here from a canvas
// (MediaRecorder, WebM), served for every .mp4. It never exists as a file.
let clip;
async function recordClip() {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(server.origin + '/', { waitUntil: 'load' });
  const b64 = await page.evaluate(async () => {
    const canvas = Object.assign(document.createElement('canvas'), { width: 64, height: 40 });
    const g = canvas.getContext('2d');
    const recorder = new MediaRecorder(canvas.captureStream(30), { mimeType: 'video/webm;codecs=vp8' });
    const chunks = [];
    recorder.ondataavailable = (e) => chunks.push(e.data);
    let frame = 0;
    const draw = setInterval(() => {
      g.fillStyle = `hsl(${(frame++ * 24) % 360} 40% 50%)`;
      g.fillRect(0, 0, 64, 40);
    }, 33);
    recorder.start();
    await new Promise((r) => setTimeout(r, 800));
    const stopped = new Promise((r) => (recorder.onstop = r));
    recorder.stop();
    await stopped;
    clearInterval(draw);
    const bytes = new Uint8Array(await new Blob(chunks).arrayBuffer());
    let bin = '';
    for (const b of bytes) bin += String.fromCharCode(b);
    return btoa(bin);
  });
  await ctx.close();
  return Buffer.from(b64, 'base64');
}

async function open(options = {}) {
  clip ??= await recordClip();
  const ctx = await browser.newContext({ viewport: DESKTOP, ...options });
  const videos = [];
  await ctx.route('**/*.mp4', (route) => {
    videos.push(new URL(route.request().url()).pathname);
    return route.fulfill({ status: 200, contentType: 'video/webm', body: clip });
  });
  const page = await ctx.newPage();
  await page.goto(server.origin + '/', { waitUntil: 'load' });
  return { ctx, page, videos };
}

const visible = (page, selector) => page.evaluate((s) => [...document.querySelectorAll(s)].some((el) => el.checkVisibility()), selector);
// Every card, as drawn: number, centre, width, opacity, tab stop.
const cards = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('[data-orbit] .card')].map((el) => {
      const r = el.getBoundingClientRect();
      return {
        no: el.dataset.no,
        part: el.classList.contains('part'),
        cx: r.left + r.width / 2,
        cy: r.top + r.height / 2,
        w: r.width,
        op: Number(getComputedStyle(el).opacity),
        tab: el.tabIndex,
      };
    }),
  );
const caption = (page) => page.evaluate(() => (document.querySelector('[data-caption].in')?.innerText ?? '').replace(/\s+/g, ' ').trim());
const openParts = async (page) => (await cards(page)).filter((c) => c.part && c.op > 0.5).map((c) => c.no);
const cover = (page, no) => page.locator(`[data-orbit] .card.cover[data-no="${no}"]`);
const restOn = async (page, no) => {
  await cover(page, no).hover();
  await page.waitForTimeout(1600);
};

test('without JS: the Index list only, no constellation, no toggle', async () => {
  const { ctx, page } = await open({ javaScriptEnabled: false });
  assert.equal(await visible(page, '[data-home-index]'), true);
  for (const s of ['[data-orbit]', '[data-view-toggle]']) assert.equal(await visible(page, s), false, `${s} shows without JS`);
  const height = await page.evaluate(() => document.querySelector('[data-row] .subs').getBoundingClientRect().height);
  assert.ok(height > 100, `the Index's sub-rows are ${height}px tall`);
  await ctx.close();
});

test('reduced motion: the Index list only, no constellation, no video', async () => {
  const { ctx, page, videos } = await open({ reducedMotion: 'reduce' });
  assert.equal(await visible(page, '[data-home-index]'), true);
  assert.equal(await visible(page, '[data-orbit]'), false);
  await page.waitForTimeout(800);
  assert.equal(await page.locator('video').count(), 0);
  assert.equal(videos.length, 0);
  await ctx.close();
});

test('at rest: every project in one row, in order, on screen; parts tucked away and out of the tab order', async () => {
  const { ctx, page } = await open();
  await page.waitForTimeout(300);
  const all = await cards(page);
  const covers = all.filter((c) => !c.part);
  assert.equal(covers.length, N);
  assert.equal(covers[0].no, 'W01');
  for (let i = 1; i < covers.length; i++) assert.ok(covers[i].cx > covers[i - 1].cx, `${covers[i].no} isn't right of ${covers[i - 1].no}`);
  for (const c of covers) {
    assert.ok(c.cx - c.w / 2 >= 0 && c.cx + c.w / 2 <= DESKTOP.width, `${c.no} is off screen`);
    assert.ok(Math.abs(c.cy - covers[0].cy) < 1, 'the row is level');
  }
  for (const p of all.filter((c) => c.part)) assert.deepEqual([p.op, p.tab], [0, -1], `${p.no} shows at rest`);
  await ctx.close();
});

test('the first poster is the preloaded, high-priority LCP image; the rest wait for it', async () => {
  const { ctx, page } = await open();
  const imgs = await page.evaluate(() =>
    [...document.querySelectorAll('[data-orbit] .cover img')].map((i) => ({ p: i.getAttribute('fetchpriority'), l: i.getAttribute('loading'), w: i.getAttribute('width') })),
  );
  assert.deepEqual(imgs[0], { p: 'high', l: null, w: '520' });
  for (const i of imgs.slice(1)) assert.equal(i.l, 'lazy');
  const preload = await page.evaluate(() => [...document.querySelectorAll('link[rel=preload][as=image]')].map((l) => [l.getAttribute('fetchpriority'), l.type]));
  assert.ok(preload.length >= 1 && preload.every(([p, t]) => p === 'high' && t === 'image/avif'));
  const lcp = await page.evaluate(
    () =>
      new Promise((done) =>
        new PerformanceObserver((list) => {
          const e = list.getEntries().at(-1);
          done(e.element?.closest('.card')?.dataset.no ?? e.element?.tagName);
        }).observe({ type: 'largest-contentful-paint', buffered: true }),
      ),
  );
  assert.equal(lcp, 'W01');
  await ctx.close();
});

test('resting on a project opens it: to the middle, its parts out of it, smaller, the others in a row below', async () => {
  const { ctx, page } = await open();
  assert.deepEqual(await openParts(page), []);
  await restOn(page, 'W01');
  const all = await cards(page);
  const w01 = all.find((c) => c.no === 'W01');
  const parts = all.filter((c) => c.part);
  assert.deepEqual(await openParts(page), PARTS);
  assert.ok(Math.abs(w01.cx - DESKTOP.width / 2) < 2, 'the open project is not in the middle');
  for (const p of parts) {
    assert.ok(p.w < w01.w * 0.6, `${p.no} isn't smaller than its project`);
    assert.equal(p.tab, 0, `${p.no} can't be tabbed to`);
  }
  for (const c of all.filter((c) => !c.part && c.no !== 'W01')) assert.ok(c.cy > w01.cy + 200 && c.w < w01.w / 2, `${c.no} isn't waiting below`);
  assert.match(await caption(page), /^W01 · Work · .*vers1ons The licensing marketplace/i);
  await ctx.close();
});

test('every part can be pointed at, the ones behind the project too', async () => {
  const { ctx, page } = await open();
  await restOn(page, 'W01');
  const reach = await page.evaluate(() =>
    [...document.querySelectorAll('[data-orbit] .card.part')].map((p) => {
      const r = p.getBoundingClientRect();
      let hits = 0;
      for (let i = 1; i < 4; i++)
        for (let j = 1; j < 4; j++) if (document.elementFromPoint(r.left + (r.width * i) / 4, r.top + (r.height * j) / 4)?.closest('.card') === p) hits++;
      return [p.dataset.no, hits];
    }),
  );
  for (const [no, hits] of reach) assert.ok(hits > 0, `${no} can't be pointed at`);
  await ctx.close();
});

test('pointing at a part brings it forward and plays its recording, muted and inline; the caption says whose part it is', async () => {
  const { ctx, page, videos } = await open();
  await restOn(page, 'W01');
  // A part never holds still (it orbits), so no waiting for it to.
  await page.locator('[data-orbit] .card.part[data-no="W01.3"]').hover({ force: true });
  await page.waitForTimeout(1200);
  assert.match(await caption(page), /^W01\.3 · Part of vers1ons Purchasing/i);
  const all = await cards(page);
  const hot = all.find((c) => c.no === 'W01.3');
  for (const p of all.filter((c) => c.part && c.no !== 'W01.3')) assert.ok(hot.w > p.w * 1.5, `W01.3 isn't forward of ${p.no}`);
  const v = await page.evaluate(() => {
    const v = document.querySelector('video');
    return { count: document.querySelectorAll('video').length, in: v?.closest('.card')?.dataset.no, muted: v?.muted, inline: v?.playsInline, controls: v?.controls };
  });
  assert.deepEqual(v, { count: 1, in: 'W01.3', muted: true, inline: true, controls: false });
  assert.ok(videos.includes('/media/vers1ons/purchasing/walkthrough.mp4'), 'the part recording was not requested');
  await ctx.close();
});

test('leaving everything puts the parts back in a moment later, and stops the video', async () => {
  const { ctx, page } = await open();
  await restOn(page, 'W01');
  await page.mouse.move(DESKTOP.width - 10, DESKTOP.height - 10);
  await page.waitForTimeout(400);
  assert.equal((await openParts(page)).length, 5, 'closed at once');
  await page.waitForTimeout(2200);
  assert.deepEqual(await openParts(page), []);
  assert.equal(await page.locator('video').count(), 0);
  await ctx.close();
});

test('keyboard: focus opens a project, Tab reaches its parts in order, Escape closes and returns, ←/→ go between projects', async () => {
  const { ctx, page } = await open();
  await page.keyboard.press('Tab'); // the frame's name link
  while (!(await page.evaluate(() => document.activeElement?.matches('[data-orbit] .card')))) await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement.dataset.no), 'W01');
  await page.waitForTimeout(1200);
  assert.deepEqual(await openParts(page), PARTS);
  const hrefs = [];
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press('Tab');
    hrefs.push(await page.evaluate(() => document.activeElement.getAttribute('href')));
  }
  assert.deepEqual(hrefs, ['/work/vers1ons/design-system/', '/work/vers1ons/licensing/', '/work/vers1ons/purchasing/', '/work/vers1ons/wallet-payouts/', '/work/vers1ons/distribution/']);
  await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(() => document.activeElement.dataset.no), 'W01');
  await page.waitForTimeout(1200);
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.evaluate(() => document.activeElement.dataset.no), 'W02');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  assert.equal(await page.evaluate(() => document.activeElement.closest('[data-project]').dataset.project), String(N - 1), '← from the first wraps to the last');
  await ctx.close();
});

test('click: the first on a closed project opens it without leaving; on the open one it follows the link', async () => {
  const { ctx, page } = await open();
  await page.locator('[data-orbit] .card.cover[data-no="W01"]').click();
  await page.waitForTimeout(1200);
  assert.equal(new URL(page.url()).pathname, '/');
  assert.deepEqual(await openParts(page), PARTS);
  await page.locator('[data-orbit] .card.cover[data-no="W01"]').click();
  await page.waitForURL('**/work/vers1ons/');
  await ctx.close();
});

test('touch: a tap brings a part forward, a second tap opens it', async () => {
  const { ctx, page } = await open({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });
  await page.locator('[data-orbit] .card.cover[data-no="W01"]').tap();
  await page.waitForTimeout(1500);
  assert.deepEqual(await openParts(page), PARTS);
  const part = page.locator('[data-orbit] .card.part[data-no="W01.1"]');
  await part.tap({ force: true });
  await page.waitForTimeout(900);
  assert.equal(new URL(page.url()).pathname, '/');
  assert.match(await caption(page), /^W01\.1 · Part of vers1ons/i);
  await part.tap({ force: true });
  await page.waitForURL('**/work/vers1ons/design-system/');
  await ctx.close();
});

test('(Index) shows the list and stops the video; (Projects) brings the constellation back', async () => {
  const { ctx, page } = await open();
  await restOn(page, 'W01');
  await page.click('[data-view-toggle]');
  assert.equal(await visible(page, '[data-home-index]'), true);
  assert.equal(await visible(page, '[data-orbit]'), false);
  await page.waitForTimeout(400);
  assert.equal(await page.locator('video').count(), 0);
  await page.click('[data-view-toggle]');
  assert.equal(await visible(page, '[data-orbit]'), true);
  assert.equal(await visible(page, '[data-home-index]'), false);
  await ctx.close();
});
