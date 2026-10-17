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

test('vers1ons alone in the middle, larger, with its caption from the start; one Index row', async () => {
  const { ctx, page } = await open();
  await page.waitForTimeout(300);
  const shape = await page.evaluate(() => {
    const covers = document.querySelectorAll('[data-orbit] .card.cover');
    const r = covers[0].getBoundingClientRect();
    return {
      covers: covers.length,
      rows: document.querySelectorAll('[data-row]').length,
      centred: Math.abs(r.left + r.width / 2 - innerWidth / 2) < 1,
      wide: Math.round(r.width),
      caption: document.querySelector('[data-caption].in [data-c="title"]')?.textContent.trim(),
    };
  });
  assert.deepEqual(shape, { covers: 1, rows: 1, centred: true, wide: 425, caption: 'vers1ons' });
  await ctx.close();
});

test('arrow keys on the page have nothing to do, and leave it alone', async () => {
  const { ctx, page } = await open();
  const prevented = await page.evaluate(() => {
    const e = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true });
    document.body.dispatchEvent(e);
    return e.defaultPrevented;
  });
  assert.equal(prevented, false);
  await ctx.close();
});

test('resting on vers1ons opens its five parts around it', async () => {
  const { ctx, page } = await open();
  await page.hover('[data-orbit] .card.cover');
  await page.waitForTimeout(1600);
  const parts = await page.evaluate(() =>
    [...document.querySelectorAll('[data-orbit] .card.part')].filter((p) => Number(getComputedStyle(p).opacity) > 0.5).map((p) => p.dataset.no),
  );
  assert.deepEqual(parts, ['W01.1', 'W01.2', 'W01.3', 'W01.4', 'W01.5']);
  await ctx.close();
});

test('every visit lands in light, even with the system in dark; the toggle switches and is remembered', async () => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark' });
  await ctx.route('**/*.mp4', (route) => route.abort());
  const page = await ctx.newPage();
  const bg = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  await page.goto(server.origin + '/', { waitUntil: 'load' });
  assert.equal(await bg(), 'rgb(242, 241, 237)', 'not light on landing');
  await page.click('[data-theme-toggle]');
  assert.equal(await bg(), 'rgb(22, 21, 19)', 'the toggle did not switch to dark');
  await page.goto(server.origin + '/work/vers1ons/', { waitUntil: 'load' });
  assert.equal(await bg(), 'rgb(22, 21, 19)', 'dark was not remembered');
  await ctx.close();
});

test("vers1ons' poster is the largest paint", async () => {
  const { ctx, page } = await open();
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
