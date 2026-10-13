// The shipped homepage with its single entry (dist/, no fixtures): vers1ons
// stands alone, with no ring to step through and nothing unbuilt in sight.
// The ring itself is tested against the fixture build in filmstrip.test.mjs.

import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { launch, serve } from '../../scripts/lib/browser.mjs';

const DIST = join(resolve(import.meta.dirname, '../..'), 'dist');

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

async function open() {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(server.origin + '/', { waitUntil: 'load' });
  return { ctx, page };
}

test('no fixture is built or linked', async () => {
  assert.equal(existsSync(join(DIST, 'work/blast-radius')), false);
  const html = await readFile(join(DIST, 'index.html'), 'utf8');
  for (const placeholder of ['Blast Radius', '[Role]', '[One line.]', 'Fixture']) assert.ok(!html.includes(placeholder), `"${placeholder}" on /`);
  const hub = await readFile(join(DIST, 'work/vers1ons/index.html'), 'utf8');
  assert.ok(!hub.includes('class="next'), 'the hub links a next entry that does not exist');
});

test('one frame, one row, no Prev / Next', async () => {
  const { ctx, page } = await open();
  const shape = await page.evaluate(() => ({
    frames: document.querySelectorAll('[data-frame]').length,
    rows: document.querySelectorAll('[data-row]').length,
    prev: !!document.querySelector('[data-strip-prev]'),
    next: !!document.querySelector('[data-strip-next]'),
    title: document.querySelector('[data-meta].on h2').textContent.trim(),
  }));
  assert.deepEqual(shape, { frames: 1, rows: 1, prev: false, next: false, title: 'vers1ons' });
  await ctx.close();
});

test('arrow keys and swipes have nothing to do, and leave the page alone', async () => {
  const { ctx, page } = await open();
  const prevented = await page.evaluate(() => {
    const e = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true });
    document.body.dispatchEvent(e);
    return e.defaultPrevented;
  });
  assert.equal(prevented, false);
  assert.equal(await page.evaluate(() => document.querySelector('[data-frame]').classList.contains('on')), true);
  await ctx.close();
});

test("resting on vers1ons still opens its parts", async () => {
  const { ctx, page } = await open();
  await page.waitForTimeout(800);
  await page.hover('[data-frame].on .hit');
  await page.waitForTimeout(1500);
  const parts = await page.evaluate(() => {
    const l = document.querySelector('[data-parts]');
    return { open: l.classList.contains('on'), links: l.querySelectorAll('a').length };
  });
  assert.deepEqual(parts, { open: true, links: 5 });
  await ctx.close();
});
