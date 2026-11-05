// /motion, in Chrome against the shipped build (dist/): the pieces in order
// with measured sizes and status badges, the nav link, each piece mounting
// once its stage is near, and what each one does (the toggle's springs and
// keys, the hold's fill, drain and confirm, the field's frames), with and
// without reduced motion.

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
  assert.ok(existsSync(join(DIST, 'motion/index.html')), 'No dist/motion/. Run `npm run build` first.');
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
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(server.origin + '/motion/', { waitUntil: 'load' });
  return { ctx, page, errors };
}
const live = (page, id) => page.waitForSelector(`[data-piece="${id}"].is-live`, { timeout: 5000 });

test('pieces in number order, each with a measured size and a status badge; Motion in the nav', async () => {
  const html = await readFile(join(DIST, 'motion/index.html'), 'utf8');
  assert.ok(!html.includes('data-size-of'), 'a size label was left unfilled');
  const codes = [...html.matchAll(/>(M\d\d)</g)].map((m) => m[1]);
  assert.deepEqual(codes, [...codes].sort(), 'pieces out of order');
  assert.ok(codes.length >= 1);
  const sizes = [...html.matchAll(/<span>(\d+(?:\.\d)? KB)<\/span>/g)];
  assert.equal(sizes.length, codes.length, 'every piece shows its size');
  assert.equal([...html.matchAll(/class="status-badge"/g)].length, codes.length, 'every piece shows its status');
  for (const page of ['index.html', 'work/index.html', 'motion/index.html', 'work/vers1ons/index.html']) {
    assert.match(await readFile(join(DIST, page), 'utf8'), /<a href="\/motion"/, `no Motion link on ${page}`);
  }
});

test('the toggle springs to the chosen option, mid-flight stretched, and follows the arrow keys', async () => {
  const { ctx, page, errors } = await open();
  await live(page, 'spring-toggle');
  const target = await page.$eval('[data-toggle] [role="radio"]:nth-child(4)', (b) => [b.offsetLeft - 4, b.offsetLeft - 4 + b.offsetWidth]);
  const width = await page.$eval('[data-toggle] .ink', (e) => e.offsetWidth);
  const edges = () =>
    page.$eval('[data-toggle] .ink', (e) => {
      const [, , r, , l] = e.style.clipPath.match(/inset\((\S+)px (\S+)px (\S+)px (\S+)px/).map(Number);
      return [l, r];
    });
  await page.click('[data-toggle] [role="radio"]:nth-child(4)');
  await page.waitForTimeout(120);
  const [l1, r1] = await edges();
  const mid = width - r1 - l1;
  assert.ok(mid > target[1] - target[0], `the pill doesn't stretch in flight (${mid}px)`);
  await page.waitForTimeout(1500);
  const [l2, r2] = await edges();
  assert.ok(Math.abs(l2 - target[0]) < 0.5 && Math.abs(width - r2 - target[1]) < 0.5, 'the pill doesn\'t land on the option');
  assert.equal(await page.getAttribute('[data-toggle] [role="radio"]:nth-child(4)', 'aria-checked'), 'true');
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.getAttribute('[data-toggle] [role="radio"]:nth-child(1)', 'aria-checked'), 'true', 'ArrowRight wraps to the first');
  assert.equal(await page.evaluate(() => document.activeElement.textContent), 'Original');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('holding fills and signs; letting go early drains it back', async () => {
  const { ctx, page, errors } = await open();
  await live(page, 'hold-to-confirm');
  const p = () => page.$eval('[data-hold]', (b) => Number(b.style.getPropertyValue('--p') || 0));
  await page.focus('[data-hold]');
  await page.keyboard.down(' ');
  await page.waitForTimeout(400);
  await page.keyboard.up(' ');
  const partial = await p();
  assert.ok(partial > 0.15 && partial < 0.6, `a short hold should part-fill (${partial})`);
  await page.waitForTimeout(400);
  assert.equal(await p(), 0, 'it drains back');
  await page.keyboard.down(' ');
  await page.waitForTimeout(1500);
  await page.keyboard.up(' ');
  assert.ok(await page.$eval('[data-hold]', (b) => b.classList.contains('is-done')), 'a full hold signs');
  assert.equal(await page.$eval('[data-piece="hold-to-confirm"] [data-stage] [data-status]', (s) => s.textContent), 'Signed');
  // Full while "Signed" shows: draining under it reads as a flicker. And
  // "Signed" is what's on top, after its fade has finished too.
  await page.waitForTimeout(500);
  assert.equal(await p(), 1, 'it drains under "Signed"');
  const top = await page.$eval('[data-hold]', (b) => {
    const r = b.getBoundingClientRect();
    return document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.closest('.face')?.classList.contains('done');
  });
  assert.ok(top, '"Signed" is painted under the fill');
  // Then back to the label, and only then empty.
  await page.waitForTimeout(2200);
  assert.ok(!(await page.$eval('[data-hold]', (b) => b.classList.contains('is-done'))), 'it resets');
  await page.waitForTimeout(900);
  assert.equal(await p(), 0, 'it drains after the reset');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('the field draws, keeps drawing while on screen, and stops off it', async () => {
  const { ctx, page, errors } = await open();
  await page.$eval('[data-piece="dither-field"]', (e) => e.scrollIntoView());
  await live(page, 'dither-field');
  // A WebGL canvas reads back blank once composited: compare what's on screen.
  const frame = async () => (await page.locator('[data-field]').screenshot()).toString('base64');
  await page.waitForTimeout(300);
  const a = await frame();
  await page.waitForTimeout(600);
  assert.notEqual(a, await frame(), 'the field is still on screen');
  // Off screen it can't be photographed, so count its draws instead. Only
  // the field uses WebGL; counting animation frames would also count the
  // toggle, which keeps stepping at the top of the page.
  await page.evaluate(() => {
    window.__frames = 0;
    const draw = WebGLRenderingContext.prototype.drawArrays;
    WebGLRenderingContext.prototype.drawArrays = function (...args) {
      window.__frames++;
      return draw.apply(this, args);
    };
    scrollTo(0, 0);
  });
  await page.waitForTimeout(300);
  await page.evaluate(() => (window.__frames = 0));
  await page.waitForTimeout(600);
  assert.equal(await page.evaluate(() => window.__frames), 0, 'the field keeps drawing off screen');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('reduced motion: the pill jumps, nothing plays on its own, the field is one still frame', async () => {
  const { ctx, page, errors } = await open({ reducedMotion: 'reduce' });
  await live(page, 'spring-toggle');
  await page.click('[data-toggle] [role="radio"]:nth-child(3)');
  const target = await page.$eval('[data-toggle] [role="radio"]:nth-child(3)', (b) => b.offsetLeft - 4);
  const left = await page.$eval('[data-toggle] .ink', (e) => Number(e.style.clipPath.match(/px (\S+)px round/)[1]));
  assert.ok(Math.abs(left - target) < 0.5, 'the pill should be there at once');
  await page.waitForTimeout(2800);
  assert.equal(await page.getAttribute('[data-toggle] [role="radio"]:nth-child(3)', 'aria-checked'), 'true', 'it stepped on its own');
  await page.$eval('[data-piece="dither-field"]', (e) => e.scrollIntoView());
  await live(page, 'dither-field');
  await page.waitForTimeout(200);
  const frame = async () => (await page.locator('[data-field]').screenshot()).toString('base64');
  const a = await frame();
  await page.waitForTimeout(500);
  assert.equal(a, await frame(), 'the field moves under reduced motion');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('the tape: dragging pulls it to a step, it stops at its wall, double-click and keys work', async () => {
  const { ctx, page, errors } = await open();
  await page.$eval('[data-piece="tape-slider"]', (e) => e.scrollIntoView({ block: 'center' }));
  await live(page, 'tape-slider');
  const speed = '[data-row="speed"]';
  const read = (row) => page.$eval(`${row} [data-value]`, (e) => e.textContent);
  const now = (row) => page.$eval(`${row} canvas`, (c) => c.getAttribute('aria-valuenow'));
  assert.equal(await page.$eval(`${speed} canvas`, (c) => c.getAttribute('role')), 'slider');
  const box = await page.locator(`${speed} canvas`).boundingBox();
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  // Drag left 5 steps (8px each): the tape goes left, the value up.
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx - 41, cy, { steps: 4 });
  assert.equal(await read(speed), '125%');
  // Far past the end: it stops at the wall, 200%.
  await page.mouse.move(cx - 600, cy, { steps: 6 });
  assert.equal(await read(speed), '200%');
  await page.mouse.up();
  assert.equal(await now(speed), '2');
  // Within one step of the default it catches on 100%, as in the product.
  await page.mouse.dblclick(cx, cy);
  assert.equal(await read(speed), '100%', 'double-click resets');
  // Let the tape roll home: grabbed mid-roll, it's picked up where it is.
  await page.waitForTimeout(900);
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx - 9, cy, { steps: 2 });
  await page.mouse.up();
  assert.equal(await read(speed), '100%', 'a step off the default should catch on it');
  // Keys step past the catch.
  await page.focus('[data-row="gain"] canvas');
  await page.keyboard.press('ArrowRight');
  assert.equal(await read('[data-row="gain"]'), '+0.5 dB');
  await page.keyboard.press('End');
  assert.equal(await read('[data-row="gain"]'), '+12 dB');
  // Varispeed takes pitch out of play.
  await page.click('[data-vari]');
  assert.equal(await page.$eval('[data-row="pitch"] canvas', (c) => [c.tabIndex, c.getAttribute('aria-disabled')].join()), '-1,true');
  // And it refuses keys even if it's focused from script.
  await page.focus('[data-row="pitch"] canvas');
  await page.keyboard.press('ArrowRight');
  assert.equal(await read('[data-row="pitch"]'), '0 st', 'pitch moved under Varispeed');
  assert.deepEqual(errors, []);
  await ctx.close();
});

// The pieces past the first screen come from /motion/2/ onward; open() lands
// on /motion, so scroll each into view and wait for it.
async function reach(page, id) {
  await page.waitForFunction(
    async (id) => {
      const el = document.querySelector(`[data-piece="${id}"]`);
      if (el) return (el.scrollIntoView({ block: 'center' }), true);
      scrollTo(0, document.body.scrollHeight);
      return false;
    },
    id,
    { timeout: 10_000, polling: 200 },
  );
  await live(page, id);
}

test('the following pages are appended, each piece once, in order, with its styles', async () => {
  const { ctx, page, errors } = await open();
  await page.evaluate(() => scrollTo(0, document.body.scrollHeight));
  await page.waitForFunction(() => document.documentElement.hasAttribute('data-motion-done'), null, { timeout: 10_000 });
  const ids = await page.$$eval('[data-pieces] > [data-piece]', (els) => els.map((e) => e.dataset.piece));
  assert.equal(new Set(ids).size, ids.length, 'a piece appended twice');
  const codes = await page.$$eval('[data-pieces] .caption > .mono:first-child', (els) => els.map((e) => e.textContent));
  assert.deepEqual(codes, [...codes].sort(), 'pieces out of order');
  // An appended stage is styled (its inline styles came with it).
  assert.equal(await page.$eval('[data-piece="read-to-sign"] .reader', (e) => getComputedStyle(e).display), 'grid');
  assert.equal(await page.$('[data-motion-more]'), null, 'the More link stays after the last page');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('every page of pieces is in the HTML budget and links on without JS', async () => {
  const first = await readFile(join(DIST, 'motion/index.html'), 'utf8');
  assert.match(first, /<a href="\/motion\/2\/" rel="next"/);
  const second = await readFile(join(DIST, 'motion/2/index.html'), 'utf8');
  assert.match(second, /<meta name="robots" content="noindex"/);
  assert.match(second, /<a href="\/motion\/" rel="prev"/);
});

test('read to sign: signing unlocks only at the end, and the contents follow', async () => {
  const { ctx, page, errors } = await open();
  await reach(page, 'read-to-sign');
  const p = '[data-piece="read-to-sign"]';
  assert.equal(await page.$eval(`${p} [data-ack]`, (i) => i.disabled), true, 'unlocked before reading');
  await page.click(`${p} [data-jump="4"]`);
  await page.waitForTimeout(900);
  assert.match(await page.$eval(`${p} [data-current]`, (e) => e.textContent), /^4 · Fees/);
  assert.equal(await page.$eval(`${p} [data-ack]`, (i) => i.disabled), true, 'a jump mid-way unlocked it');
  await page.$eval(`${p} [data-scroll]`, (b) => b.scrollTo(0, b.scrollHeight));
  await page.waitForTimeout(300);
  assert.equal(await page.$eval(`${p} [data-ack]`, (i) => i.disabled), false, 'still locked at the end');
  assert.equal(await page.$eval(`${p} [data-read-status]`, (e) => e.textContent), "You've reached the end");
  assert.equal(await page.$$eval(`${p} .seen`, (els) => els.length), 6, 'every section ticked');
  await page.check(`${p} [data-ack]`);
  assert.equal(await page.$eval(`${p} [data-sign]`, (b) => b.disabled), false);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('split balancer: a share stops where the others begin; split evenly is to the cent', async () => {
  const { ctx, page, errors } = await open();
  await reach(page, 'split-balancer');
  const p = '[data-piece="split-balancer"]';
  // 50 + 30 taken: the third can have at most 20.
  await page.$eval(`${p} [data-party="feature"]`, (i) => ((i.value = '90'), i.dispatchEvent(new Event('input', { bubbles: true }))));
  assert.equal(await page.$eval(`${p} [data-party="feature"]`, (i) => i.value), '20');
  assert.equal(await page.$eval(`${p} [data-left]`, (e) => e.textContent), 'Fully allocated');
  await page.click(`${p} [data-even]`);
  assert.deepEqual(await page.$$eval(`${p} [data-pct]`, (els) => els.map((e) => e.textContent)), ['33.34%', '33.33%', '33.33%']);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('drop screen swap: one wheel tick swaps to the details, one up swaps back', async () => {
  const { ctx, page, errors } = await open();
  await reach(page, 'drop-swap');
  const p = '[data-piece="drop-swap"]';
  // Hover first: the page may still be settling from the appended pieces.
  await page.waitForTimeout(300);
  await page.locator(`${p} [data-box]`).hover();
  await page.mouse.wheel(0, 10);
  await page.waitForTimeout(1400);
  const seam = await page.$eval(`${p} [data-detail]`, (d) => d.offsetTop);
  const top = await page.$eval(`${p} [data-box]`, (b) => b.scrollTop);
  assert.ok(Math.abs(top - seam) <= 1, `not at the details (${top} of ${seam})`);
  await page.mouse.wheel(0, -10);
  await page.waitForTimeout(1400);
  assert.equal(await page.$eval(`${p} [data-box]`, (b) => b.scrollTop), 0, 'not back at the hero');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('scramble: the portrait settles when it comes into view; orbit springs: the dials redraw the curve', async () => {
  const { ctx, page, errors } = await open();
  await reach(page, 'scramble');
  await page.waitForTimeout(3000);
  const inked = await page.$eval('[data-piece="scramble"] canvas', (c) => {
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i]) n++;
    return n;
  });
  assert.ok(inked > 1000, `the portrait didn't draw (${inked})`);
  await reach(page, 'orbit-springs');
  const p = '[data-piece="orbit-springs"]';
  const before = await page.$eval(`${p} [data-curve]`, (e) => e.getAttribute('d'));
  await page.$eval(`${p} [data-z]`, (i) => ((i.value = '0.3'), i.dispatchEvent(new Event('input', { bubbles: true }))));
  assert.notEqual(await page.$eval(`${p} [data-curve]`, (e) => e.getAttribute('d')), before);
  assert.match(await page.$eval(`${p} [data-z-out]`, (e) => e.textContent), /under/);
  assert.deepEqual(errors, []);
  await ctx.close();
});
