// The shipped /work page with its real entries (dist/, no fixtures):
// vers1ons (W01), Vera (W02) and Bespoke (S01) side by side, nothing
// unbuilt in sight. The
// ring itself is tested against the fixture build in filmstrip.test.mjs.

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
  await page.goto(server.origin + '/work/', { waitUntil: 'load' });
  return { ctx, page };
}

test('no fixture is built or linked', async () => {
  assert.equal(existsSync(join(DIST, 'work/blast-radius')), false);
  for (const page of ['index.html', 'work/index.html']) {
    const html = await readFile(join(DIST, page), 'utf8');
    for (const placeholder of ['Blast Radius', '[Role]', '[One line.]', 'Fixture']) assert.ok(!html.includes(placeholder), `"${placeholder}" on ${page}`);
  }
  for (const page of ['work/vers1ons/index.html', 'work/vera/index.html']) {
    const html = await readFile(join(DIST, page), 'utf8');
    for (const placeholder of ['[Role]', '[One line.]', 'Fixture']) assert.ok(!html.includes(placeholder), `"${placeholder}" on ${page}`);
  }
  const hub = await readFile(join(DIST, 'work/vers1ons/index.html'), 'utf8');
  assert.ok(/class="next[^>]*>[\s\S]*?href="\/work\/vera\/"/.test(hub) || hub.includes('href="/work/vera/"'), 'the vers1ons hub does not lead on to Vera');
});

test('vers1ons, Vera and Bespoke side by side, the same size, in order; three Index rows', async () => {
  const { ctx, page } = await open();
  await page.waitForTimeout(300);
  const shape = await page.evaluate(() => {
    const covers = [...document.querySelectorAll('[data-orbit] .card.cover')];
    const r = covers.map((c) => c.getBoundingClientRect());
    return {
      covers: covers.length,
      order: covers.map((c) => c.dataset.no),
      rows: document.querySelectorAll('[data-row]').length,
      // The outer two turn toward the middle by the same amount.
      sameSize: Math.abs(r[0].width - r.at(-1).width) < 1,
      leftToRight: r.every((x, i) => !i || r[i - 1].left < x.left),
      centred: Math.abs((r[0].left + r.at(-1).right) / 2 - innerWidth / 2) < 1,
    };
  });
  assert.deepEqual(shape, { covers: 3, order: ['W01', 'W02', 'S01'], rows: 3, sameSize: true, leftToRight: true, centred: true });
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

test('resting on vers1ons opens its five parts around it, and its money page', async () => {
  const { ctx, page } = await open();
  await page.hover('[data-orbit] .card.cover');
  await page.waitForTimeout(1600);
  const parts = await page.evaluate(() =>
    [...document.querySelectorAll('[data-orbit] .card.part')].filter((p) => Number(getComputedStyle(p).opacity) > 0.5).map((p) => p.dataset.no),
  );
  assert.deepEqual(parts, ['W01.1', 'W01.2', 'W01.3', 'W01.4', 'W01.5', 'W01.$']);
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
  // Text paints before the poster arrives, so the first candidate can be a
  // line of the caption; the poster replaces it once it paints. Wait for
  // the poster (or give up after 5s and report the last candidate).
  const lcp = await page.evaluate(
    () =>
      new Promise((done) => {
        let last = 'none';
        const timer = setTimeout(() => done(last), 5000);
        new PerformanceObserver((list) => {
          for (const e of list.getEntries()) {
            last = e.element?.closest('.card')?.dataset.no ?? e.element?.tagName;
            if (last === 'W01') (clearTimeout(timer), done(last));
          }
        }).observe({ type: 'largest-contentful-paint', buffered: true });
      }),
  );
  assert.equal(lcp, 'W01');
  await ctx.close();
});
