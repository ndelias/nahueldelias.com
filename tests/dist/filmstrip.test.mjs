// The homepage filmstrip's behaviour (§7.5, §9 step 4b), in Chrome against
// the built site: what exists with and without JS or motion, where focus
// lands and goes, the loop, keys, links, and the LCP poster. Runs against
// dist/: build first.

import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { launch, serve } from '../../scripts/lib/browser.mjs';

const DIST = join(resolve(import.meta.dirname, '../..'), 'dist');
const DESKTOP = { width: 1440, height: 900 };
const N = 8; // fixture entries

let server;
let browser;
before(async () => {
  assert.ok(existsSync(DIST), 'No dist/. Run `npm run build` first.');
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

const visible = (page, selector) => page.evaluate((s) => [...document.querySelectorAll(s)].some((el) => el.checkVisibility()), selector);
const counter = (page) => page.textContent('[data-strip-count]');
const focused = (page) =>
  page.evaluate(() => {
    const f = document.querySelector('[data-frame].on');
    const r = f.getBoundingClientRect();
    return { label: f.firstElementChild.getAttribute('aria-label'), cx: r.left + r.width / 2, w: r.width, h: r.height };
  });

test('without JS: the Index list only, no strip and none of its controls', async () => {
  const { ctx, page } = await open({ javaScriptEnabled: false });
  assert.equal(await visible(page, '[data-home-index]'), true);
  for (const s of ['.filmstrip', '[data-view-toggle]', '[data-strip-count]', '[data-strip-prev]', '[data-strip-next]']) {
    assert.equal(await visible(page, s), false, `${s} shows without JS`);
  }
  await ctx.close();
});

test('reduced motion: the Index list only, no strip, no toggle', async () => {
  const { ctx, page } = await open({ reducedMotion: 'reduce' });
  assert.equal(await visible(page, '[data-home-index]'), true);
  for (const s of ['.filmstrip', '[data-view-toggle]', '[data-strip-count]', '[data-strip-prev]']) {
    assert.equal(await visible(page, s), false, `${s} shows with reduced motion`);
  }
  await ctx.close();
});

test('lands on W01, centred and large; weight 1 is larger than the rest at rest', async () => {
  const { ctx, page } = await open();
  await page.waitForTimeout(700);
  assert.equal(await counter(page), '01');
  const f = await focused(page);
  assert.equal(f.label, 'vers1ons, Work');
  assert.deepEqual([f.w, f.h, Math.round(f.cx)], [520, 325, 720]);
  const sizes = await page.evaluate(() =>
    [...document.querySelectorAll('[data-frame]:not(.on):not([aria-hidden])')].map((el) => ({
      no: el.querySelector('.label').textContent,
      w: el.getBoundingClientRect().width,
    })),
  );
  for (const { no, w } of sizes) assert.equal(w, no === 'W02' ? 168 : 124, `${no} at rest`);
  assert.equal(await visible(page, '[data-home-index]'), false);
  await ctx.close();
});

test('duplicates are aria-hidden: one real frame per entry, the focused one among them', async () => {
  const { ctx, page } = await open();
  for (const step of [0, 3, -9]) {
    if (step) await page.evaluate((s) => [...Array(Math.abs(s))].forEach(() => document.querySelector(s > 0 ? '[data-strip-next]' : '[data-strip-prev]').click()), step);
    const real = await page.evaluate(() => [...document.querySelectorAll('[data-frame]:not([aria-hidden])')].map((f) => f.querySelector('.label').textContent));
    assert.equal(real.length, N);
    assert.equal(new Set(real).size, N);
    assert.equal(await page.locator('[data-frame].on[aria-hidden]').count(), 0);
  }
  await ctx.close();
});

test('tab order: only the focused frame and real controls', async () => {
  const { ctx, page } = await open();
  const order = [];
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab');
    order.push(
      await page.evaluate(() => {
        const el = document.activeElement;
        return el.closest('[data-frame]') ? `frame:${el.getAttribute('aria-label')}` : el.getAttribute('aria-label') || el.textContent.trim();
      }),
    );
  }
  const frames = order.filter((o) => o.startsWith('frame:'));
  assert.deepEqual([...new Set(frames)], ['frame:vers1ons, Work'], order.join(' | '));
  for (const want of ['Show as an index', 'Previous project', 'Next project', 'Open']) {
    assert.ok(order.includes(want), `${want} is not in the tab order: ${order.join(' | ')}`);
  }
  // Only the focused entry's Open link: one per lap.
  assert.equal(order.slice(0, order.indexOf('Next project') + 1).filter((o) => o === 'Open').length, 1);
  await ctx.close();
});

test('←/→ on the page body and in the strip, never while typing or on another control', async () => {
  const { ctx, page } = await open();
  await page.keyboard.press('ArrowRight');
  assert.equal(await counter(page), '02');
  await page.focus('[data-frame].on .hit');
  await page.keyboard.press('ArrowRight');
  assert.equal(await counter(page), '03');
  assert.equal(await page.evaluate(() => document.activeElement.getAttribute('aria-label')), 'Bespoke, Study', 'focus follows');
  await page.focus('[data-view-toggle]');
  await page.keyboard.press('ArrowRight');
  assert.equal(await counter(page), '03');
  await page.evaluate(() => document.body.append(Object.assign(document.createElement('input'), { id: 't' })));
  await page.focus('#t');
  await page.keyboard.press('ArrowLeft');
  assert.equal(await counter(page), '03');
  await ctx.close();
});

test('endless both ways: held keys never run off the end or jump on screen', async () => {
  const { ctx, page } = await open();
  // Final positions only, so every step can be checked where it lands.
  await page.addStyleTag({ content: '.frame{transition:none!important}' });
  const rects = () => page.evaluate(() => [...document.querySelectorAll('[data-frame]')].map((f) => f.getBoundingClientRect().left));
  const offscreen = (x) => x > DESKTOP.width || x < -520;
  let at = 0;
  for (const [key, times] of [['ArrowLeft', 30], ['ArrowRight', 45]]) {
    for (let i = 0; i < times; i++) {
      const was = await rects();
      await page.keyboard.press(key);
      const now = await rects();
      now.forEach((x, j) => {
        if (Math.abs(x - was[j]) > 1000) assert.ok(offscreen(x) && offscreen(was[j]), `frame ${j} jumped on screen: ${was[j]} → ${x}`);
      });
      at += key === 'ArrowRight' ? 1 : -1;
    }
    assert.equal(await counter(page), String((((at % N) + N) % N) + 1).padStart(2, '0'));
    assert.equal(Math.round((await focused(page)).cx), 720);
  }
  await ctx.close();
});

test('hover, click and Prev/Next move focus; Enter or a click on the focused frame opens a page only if it has one', async () => {
  const { ctx, page } = await open();
  await page.waitForTimeout(700);
  // Hover W02.
  const w02 = page.locator('[data-frame]:not([aria-hidden]) .hit[aria-label="Blast Radius, Work"]');
  await w02.hover();
  assert.equal(await counter(page), '02');
  await page.click('[data-strip-next]');
  await page.click('[data-strip-prev]');
  assert.equal(await counter(page), '02');
  // S01 has no page: its frame is a button, and no Open link renders.
  await page.evaluate(() => document.activeElement.blur());
  await page.keyboard.press('ArrowRight');
  await page.focus('[data-frame].on .hit');
  assert.equal(await page.evaluate(() => document.activeElement.tagName), 'BUTTON');
  assert.equal(await page.locator('[data-meta].on .open').count(), 0);
  await page.keyboard.press('Enter');
  assert.equal(new URL(page.url()).pathname, '/');
  // Clicking an unfocused linked frame focuses it without leaving.
  await page.evaluate(() => document.querySelector('[data-frame]:not([aria-hidden]) a.hit[aria-label="vers1ons, Work"]').click());
  assert.equal(await counter(page), '01');
  assert.equal(new URL(page.url()).pathname, '/');
  assert.equal(await page.locator('[data-meta].on .open').count(), 1);
  await page.focus('[data-frame].on .hit');
  await Promise.all([page.waitForURL('**/work/vers1ons/'), page.keyboard.press('Enter')]);
  await ctx.close();
});

test('(Index)/(Strip) switches views; the list follows the strip', async () => {
  const { ctx, page } = await open();
  await page.keyboard.press('ArrowRight');
  await page.click('[data-view-toggle]');
  assert.equal(await visible(page, '.filmstrip'), false);
  assert.equal(await visible(page, '[data-home-index]'), true);
  assert.equal((await page.innerText('[data-view-toggle]')).toLowerCase(), '(strip)');
  assert.equal(await page.evaluate(() => [...document.querySelectorAll('[data-row]')].findIndex((r) => r.hasAttribute('data-active'))), 1);
  await page.click('[data-view-toggle]');
  assert.equal(await visible(page, '.filmstrip'), true);
  await ctx.close();
});

test('no video yet: no <video>, no "Playing" line', async () => {
  const { ctx, page } = await open();
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(600);
  assert.equal(await page.locator('video').count(), 0);
  assert.equal(await page.locator('.hud').count(), 0);
  await ctx.close();
});

test('W01 poster is the preloaded, high-priority LCP image; the rest are lazy', async () => {
  const { ctx, page } = await open();
  const imgs = await page.evaluate(() =>
    [...document.querySelectorAll('[data-frame] img')].map((i) => ({ p: i.getAttribute('fetchpriority'), l: i.getAttribute('loading'), w: i.getAttribute('width'), h: i.getAttribute('height') })),
  );
  assert.deepEqual(imgs[0], { p: 'high', l: null, w: '520', h: '325' });
  for (const i of imgs.slice(1)) assert.equal(i.l, 'lazy');
  const preload = await page.evaluate(() => [...document.querySelectorAll('link[rel=preload][as=image]')].map((l) => [l.getAttribute('fetchpriority'), l.type]));
  assert.ok(preload.length >= 1 && preload.every(([p, t]) => p === 'high' && t === 'image/avif'));
  const lcp = await page.evaluate(
    () =>
      new Promise((done) =>
        new PerformanceObserver((list) => {
          const e = list.getEntries().at(-1);
          done(e.element?.closest('[data-frame]')?.querySelector('.label')?.textContent ?? e.element?.tagName);
        }).observe({ type: 'largest-contentful-paint', buffered: true }),
      ),
  );
  assert.equal(lcp, 'W01');
  await ctx.close();
});

test('phone: a horizontal swipe is one step', async () => {
  const { ctx, page } = await open({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const swipe = (dx) =>
    page.evaluate((dx) => {
      const v = document.querySelector('.viewport');
      const fire = (type, x) => v.dispatchEvent(new PointerEvent(type, { pointerType: 'touch', clientX: x, clientY: 500, bubbles: true }));
      fire('pointerdown', 200);
      fire('pointerup', 200 + dx);
    }, dx);
  await swipe(-80);
  assert.equal(await counter(page), '02');
  await swipe(90);
  await swipe(90);
  assert.equal(await counter(page), '08');
  await swipe(20); // too short
  assert.equal(await counter(page), '08');
  await ctx.close();
});

// The video path end to end. No entry has a recording yet, so the tests give
// one: a clip recorded here from a canvas (MediaRecorder, WebM), served by the
// test at /__test/ and set on an entry's frame. It never exists as a file, so
// it can't reach dist/.
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

/** / with test clips on entries: { 1: 'clip' } gives W02 the good clip; 'missing' is a 404. */
async function withVideos(videos, options = {}) {
  clip ??= await recordClip();
  const { ctx, page } = await open(options);
  const requests = [];
  await ctx.route('**/__test/*.webm', (route) => {
    requests.push(route.request().url());
    return route.request().url().endsWith('/clip.webm')
      ? route.fulfill({ status: 200, contentType: 'video/webm', body: clip })
      : route.fulfill({ status: 404, body: '' });
  });
  await page.evaluate((videos) => {
    const frames = document.querySelectorAll('[data-strip] > [data-frame]');
    for (const [i, name] of Object.entries(videos)) frames[i].dataset.video = `/__test/${name}.webm`;
  }, videos);
  return { ctx, page, requests };
}
const playing = (page) => page.waitForSelector('[data-frame].on.playing video', { timeout: 5000 });

test('video: loads only on focus, swaps into the focused frame, muted and inline', async () => {
  assert.ok(clip === undefined || clip.length > 0);
  const { ctx, page, requests } = await withVideos({ 1: 'clip' });
  await page.waitForTimeout(500);
  assert.equal(requests.length, 0, 'fetched before focus');
  assert.equal(await page.locator('video').count(), 0);
  await page.keyboard.press('ArrowRight');
  await playing(page);
  const v = await page.evaluate(() => {
    const v = document.querySelector('video');
    return {
      inFocused: !!v.closest('[data-frame].on'),
      label: v.closest('[data-frame]').querySelector('.label').textContent,
      muted: v.muted,
      inline: v.playsInline,
      controls: v.controls,
      autoplayAttr: v.hasAttribute('autoplay'),
      paused: v.paused,
    };
  });
  assert.deepEqual(v, { inFocused: true, label: 'W02', muted: true, inline: true, controls: false, autoplayAttr: false, paused: false });
  assert.equal(requests.length >= 1, true);
  await ctx.close();
});

test('video: one element only, moved from frame to frame', async () => {
  const { ctx, page } = await withVideos({ 1: 'clip', 2: 'clip' });
  await page.keyboard.press('ArrowRight');
  await playing(page);
  const first = await page.evaluateHandle(() => document.querySelector('video'));
  await page.keyboard.press('ArrowRight');
  await playing(page);
  assert.equal(await page.locator('video').count(), 1);
  assert.equal(await page.evaluate(() => document.querySelector('video').closest('[data-frame]').querySelector('.label').textContent), 'S01');
  assert.equal(await page.evaluate((v) => v === document.querySelector('video'), first), true, 'a new <video> was created');
  await ctx.close();
});

test('video: pauses and detaches when focus leaves', async () => {
  const { ctx, page } = await withVideos({ 1: 'clip' });
  await page.keyboard.press('ArrowRight');
  await playing(page);
  const v = await page.evaluateHandle(() => document.querySelector('video'));
  await page.keyboard.press('ArrowRight'); // S01: no video
  await page.waitForTimeout(400);
  assert.deepEqual(await page.evaluate((v) => ({ paused: v.paused, attached: v.isConnected, src: v.getAttribute('src') }), v), {
    paused: true,
    attached: false,
    src: null,
  });
  assert.equal(await page.locator('video').count(), 0);
  assert.equal(await page.locator('.playing').count(), 0);
  await ctx.close();
});

test('video: a clip that fails to load leaves the frame on its poster', async () => {
  const { ctx, page, requests } = await withVideos({ 1: 'missing' });
  await page.keyboard.press('ArrowRight');
  await page.waitForFunction(() => !document.querySelector('video'), null, { timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(300);
  assert.ok(requests.some((u) => u.endsWith('/missing.webm')), 'the clip was never requested');
  assert.equal(await page.locator('video').count(), 0);
  assert.equal(await page.locator('[data-frame].on.playing').count(), 0);
  assert.equal(await page.evaluate(() => document.querySelector('[data-frame].on img').checkVisibility()), true);
  await ctx.close();
});

test('video: none under reduced motion', async () => {
  const { ctx, page, requests } = await withVideos({ 0: 'clip', 1: 'clip' }, { reducedMotion: 'reduce' });
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(800);
  assert.equal(await page.locator('video').count(), 0);
  assert.equal(requests.length, 0);
  await ctx.close();
});
