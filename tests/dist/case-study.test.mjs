// The case study template (§9 step 5) in Chrome against the built hub,
// /work/vers1ons/: the parts matrix as a screen reader reads it, the versions
// stack with and without motion or JS, and Figure's recordings. Runs against
// dist/: build first.

import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { launch, serve } from '../../scripts/lib/browser.mjs';

const DIST = join(resolve(import.meta.dirname, '../..'), 'dist');
const HUB = '/work/vers1ons/';
const DESKTOP = { width: 1440, height: 900 };

let server;
let browser;
before(async () => {
  assert.ok(existsSync(join(DIST, HUB, 'index.html')), 'No built hub. Run `npm run build` first.');
  server = await serve(DIST);
  browser = await launch();
});
after(async () => {
  await browser?.close();
  await server?.close();
});

async function open(options = {}, { html } = {}) {
  const ctx = await browser.newContext({ viewport: DESKTOP, ...options });
  if (html) await ctx.route(`**${HUB}`, (route) => route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html }));
  const page = await ctx.newPage();
  await page.goto(server.origin + HUB, { waitUntil: 'load' });
  return { ctx, page };
}

test('parts matrix: one row per part, each dot named for screen readers', async () => {
  const { ctx, page } = await open();
  const rows = await page.evaluate(() =>
    [...document.querySelectorAll('.matrix tbody tr')].map((tr) => ({
      part: tr.querySelector('[role=rowheader] .title').textContent,
      cells: [...tr.querySelectorAll('.cell')].map((td) => td.querySelector('.visually-hidden').textContent),
    })),
  );
  assert.deepEqual(rows.map((r) => r.part), ['Design system', 'Licensing', 'Purchasing', 'Wallet & payouts', 'Distribution']);
  // Columns: Product, Design, Frontend, Backend.
  assert.deepEqual(rows[0].cells, ['Contributed', 'Led', 'Led', 'Not involved']);
  assert.deepEqual(rows[3].cells, ['Led', 'Not involved', 'Contributed', 'Led']);
  const headers = await page.$$eval('.matrix thead th', (ths) => ths.map((th) => th.textContent.trim()));
  assert.deepEqual(headers, ['No.', 'Preview', 'Part', 'Product', 'Design', 'Frontend', 'Backend', 'Link']);
  // The dots themselves are decoration: the text is what's read.
  assert.equal(await page.locator('.matrix .dot:not([aria-hidden="true"])').count(), 0);
  assert.match(await page.textContent('#parts-label'), /in five parts/);
  await ctx.close();
});

const front = (page) =>
  page.evaluate(() => {
    const frames = [...document.querySelectorAll('[data-version]')];
    return frames.findIndex((f) => f.style.getPropertyValue('--depth').trim() === '0');
  });

test('versions: tabs riffle the stack, the picked frame to the front', async () => {
  const { ctx, page } = await open();
  assert.equal(await page.getAttribute('[data-versions-tabs]', 'role'), 'tablist');
  assert.equal(await front(page), 2, 'lands on the newest version');
  await page.click('#version-tab-0');
  assert.equal(await front(page), 0);
  assert.equal(await page.getAttribute('#version-tab-0', 'aria-selected'), 'true');
  assert.equal(await page.getAttribute('#version-tab-2', 'aria-selected'), 'false');
  assert.equal(await page.getAttribute('#version-0', 'aria-hidden'), null, 'the front frame is the panel');
  assert.equal(await page.getAttribute('#version-2', 'aria-hidden'), 'true', 'frames behind are hidden from AT');
  // Frames behind step down and right, smaller, once the riffle settles.
  await page.waitForTimeout(700);
  const [a, b] = await page.$$eval('#version-0, #version-1', (els) => els.map((e) => e.getBoundingClientRect().toJSON()));
  assert.ok(b.x > a.x || b.y > a.y, 'a frame behind is not offset');
  await ctx.close();
});

test('versions: arrow keys, Home and End move selection and focus (roving tabindex)', async () => {
  const { ctx, page } = await open();
  await page.focus('#version-tab-2');
  await page.keyboard.press('ArrowDown'); // wraps
  assert.equal(await page.evaluate(() => document.activeElement.id), 'version-tab-0');
  assert.equal(await front(page), 0);
  await page.keyboard.press('End');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'version-tab-2');
  await page.keyboard.press('ArrowLeft');
  assert.equal(await front(page), 1);
  await page.keyboard.press('Home');
  assert.equal(await front(page), 0);
  assert.deepEqual(await page.$$eval('[data-version-tab]', (t) => t.map((b) => b.tabIndex)), [0, -1, -1]);
  await ctx.close();
});

for (const [name, options] of [
  ['reduced motion', { reducedMotion: 'reduce' }],
  ['without JS', { javaScriptEnabled: false }],
]) {
  test(`versions, ${name}: a static strip, no tabs`, async () => {
    const { ctx, page } = await open(options);
    assert.equal(await page.locator('[data-version-tab]').first().isVisible(), false, 'tabs show');
    assert.equal(await page.getAttribute('[data-versions-tabs]', 'role'), null);
    assert.equal(await page.locator('[data-version][role]').count(), 0);
    const boxes = await page.$$eval('[data-version]', (els) => els.map((e) => e.getBoundingClientRect().toJSON()));
    assert.ok(boxes[0].right <= boxes[1].left && boxes[1].right <= boxes[2].left, 'frames overlap instead of sitting side by side');
    await ctx.close();
  });
}

// Figure's recordings. No fixture has one yet, so the test gives the hub's
// hero and Fig. 1 a clip: a WebM recorded here from a canvas, served at
// /__test/ (it never exists as a file, so it can't reach dist/), added to the
// built HTML in the markup Figure renders for a video.
let clip;
async function recordClip() {
  const { ctx, page } = await open();
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

async function withVideos(options = {}) {
  clip ??= await recordClip();
  let html = await readFile(join(DIST, HUB, 'index.html'), 'utf8');
  // Figure's scope attribute, from its media box.
  const cid = html.match(/<div class="media"[^>]*\s(data-astro-cid-\w+)/)[1];
  const medias = [...html.matchAll(/<div class="media" [^>]*>/g)];
  assert.equal(medias.length, 2, 'expected the hero and Fig. 1');
  const [hero, fig] = medias;
  const video = (play) => `<video class="video" ${cid} data-src="/__test/clip.webm" data-play="${play}" muted playsinline preload="none"${play === 'view' ? ' loop' : ''}></video>`;
  const insertAt = (h, at, s) => h.slice(0, at) + s + h.slice(at);
  // Fig. 1 first, so the hero's offsets stay put.
  html = insertAt(html, fig.index + fig[0].length, video('view'));
  const caption = html.indexOf('<figcaption', fig.index);
  const captionOpen = html.indexOf('>', caption) + 1;
  html = insertAt(html, captionOpen, `<button class="pause mono" ${cid} type="button" data-figure-pause aria-pressed="false">(Pause)</button>`);
  html = insertAt(html, hero.index + hero[0].length, video('click') + `<button class="play" ${cid} type="button" data-figure-play aria-label="Play walkthrough, muted"></button>`);

  const { ctx, page } = await open(options, { html });
  const requests = [];
  await ctx.route('**/__test/clip.webm', (route) => {
    requests.push(route.request().url());
    return route.fulfill({ status: 200, contentType: 'video/webm', body: clip });
  });
  await page.reload({ waitUntil: 'load' });
  return { ctx, page, requests };
}

const state = (page, which) =>
  page.evaluate((which) => {
    const v = document.querySelector(`video[data-play="${which}"]`);
    return { src: v.getAttribute('src'), paused: v.paused, muted: v.muted, controls: v.controls, playing: v.closest('[data-figure]').classList.contains('playing') };
  }, which);

test('figure: an in-view recording loads only in view, plays muted, pauses out of view', async () => {
  const { ctx, page, requests } = await withVideos();
  assert.equal((await state(page, 'view')).src, null, 'loaded before it was in view');
  assert.equal(requests.length, 0);
  await page.locator('video[data-play="view"]').scrollIntoViewIfNeeded();
  await page.waitForFunction(() => !document.querySelector('video[data-play="view"]').paused);
  const s = await state(page, 'view');
  assert.equal(s.muted, true);
  assert.equal(s.playing, true);
  await page.evaluate(() => scrollTo(0, 0));
  await page.waitForFunction(() => document.querySelector('video[data-play="view"]').paused);
  await ctx.close();
});

test('figure: Pause stops an in-view recording and keeps it stopped in view', async () => {
  const { ctx, page } = await withVideos();
  await page.locator('video[data-play="view"]').scrollIntoViewIfNeeded();
  await page.waitForFunction(() => !document.querySelector('video[data-play="view"]').paused);
  await page.click('[data-figure-pause]');
  assert.equal((await state(page, 'view')).paused, true);
  assert.equal(await page.getAttribute('[data-figure-pause]', 'aria-pressed'), 'true');
  assert.equal(await page.textContent('[data-figure-pause]'), '(Play)');
  // Scrolling away and back doesn't restart it.
  await page.evaluate(() => scrollTo(0, 0));
  await page.locator('video[data-play="view"]').scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  assert.equal((await state(page, 'view')).paused, true);
  await page.click('[data-figure-pause]');
  await page.waitForFunction(() => !document.querySelector('video[data-play="view"]').paused);
  await ctx.close();
});

test('figure, reduced motion: the poster only, the recording never loads, no Pause', async () => {
  const { ctx, page, requests } = await withVideos({ reducedMotion: 'reduce' });
  await page.locator('video[data-play="view"]').scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  assert.equal((await state(page, 'view')).src, null);
  assert.equal(requests.length, 0);
  assert.equal(await page.locator('[data-figure-pause]').isVisible(), false);
  await ctx.close();
});

test('figure: the walkthrough plays only when asked, muted with controls, and takes focus', async () => {
  const { ctx, page, requests } = await withVideos();
  await page.waitForTimeout(300);
  assert.equal((await state(page, 'click')).src, null);
  assert.equal(requests.length, 0, 'the walkthrough loaded before Play');
  await page.click('[data-figure-play]');
  await page.waitForFunction(() => !document.querySelector('video[data-play="click"]').paused);
  const s = await state(page, 'click');
  assert.equal(s.muted, true);
  assert.equal(s.controls, true);
  assert.equal(await page.locator('[data-figure-play]').count(), 0, 'the Play button stays');
  assert.equal(await page.evaluate(() => document.activeElement?.dataset.play), 'click');
  await ctx.close();
});
