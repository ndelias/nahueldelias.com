// The impact row under a case study's header, and Distribution's "What
// changed" arriving after the first paint (<Comparisons later />), in Chrome
// against the shipped build (dist/).

import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { launch, serve } from '../../scripts/lib/browser.mjs';

const DIST = join(resolve(import.meta.dirname, '../..'), 'dist');
const PART = '/work/vers1ons/distribution/';

let server;
let browser;
before(async () => {
  assert.ok(existsSync(join(DIST, PART, 'index.html')), 'No Distribution page in dist/. Run `npm run build` first.');
  server = await serve(DIST);
  browser = await launch();
});
after(async () => {
  await browser?.close();
  await server?.close();
});

const html = (path) => readFile(join(DIST, path, 'index.html'), 'utf8');
const stats = (page) => [...page.matchAll(/<li><b>([^<]+)<\/b> ([^<]+)<\/li>/g)].map((m) => m[1]);

test('the row sits under the header, before the facts, with each number and its label', async () => {
  const page = await html(PART);
  const row = page.match(/<ul class="impact">[\s\S]*?<\/ul>/)?.[0];
  assert.ok(row, 'no impact row on Distribution');
  assert.deepEqual(stats(row), ['100', '50%']);
  assert.ok(page.indexOf('data-entry-header') < page.indexOf('class="impact"'), 'the row is above the header');
  assert.ok(page.indexOf('class="impact"') < page.indexOf('class="facts'), 'the row is below the facts');
  assert.deepEqual(stats((await html('/work/vera/')).match(/<ul class="impact">[\s\S]*?<\/ul>/)[0]), ['48 of 50', '1–2 cents', '40%']);
});

test('a page without numbers has no row', async () => {
  assert.doesNotMatch(await html('/work/vers1ons/purchasing/'), /class="impact"/);
});

test("Distribution's HTML holds only the heading and a link; the section's own page holds the pairs", async () => {
  const page = await html(PART);
  const stub = page.match(/<section class="comparisons later[^"]*"[^>]*data-later="([^"]+)"[\s\S]*?<\/section>/);
  assert.ok(stub, 'no stand-in for What changed');
  assert.equal(stub[1], `${PART}changes/`);
  assert.match(stub[0], /id="comparisons-label"/);
  assert.match(stub[0], new RegExp(`<a class="more[^"]*" href="${PART}changes/"`));
  assert.doesNotMatch(page, /data-compare-panel/, 'the pairs are in the HTML');
  const own = await html(`${PART}changes/`);
  assert.match(own, /<meta name="robots" content="noindex"/);
  assert.ok((own.match(/data-compare-panel=/g) ?? []).length >= 3, 'the changes page has no pairs');
});

test('with JS the section comes in after the first paint, in place, and runs as tabs', async () => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(server.origin + PART, { waitUntil: 'load' });
  await page.waitForSelector('.comparisons.is-tabbed', { state: 'attached' });
  const state = await page.evaluate(() => ({
    stubs: document.querySelectorAll('[data-later]').length,
    sections: document.querySelectorAll('.comparisons').length,
    afterSteps: !!document.querySelector('.steps ~ .comparisons'),
    tabs: document.querySelectorAll('.comparisons [role="tab"]').length,
  }));
  assert.equal(state.stubs, 0, 'the stand-in is still there');
  assert.equal(state.sections, 1);
  assert.ok(state.afterSteps, 'the section is not where the stand-in was');
  assert.ok(state.tabs >= 3, 'the comparisons are not tabs');
  await ctx.close();
});

test('phone: the row reads one number per line, nothing off the side', async () => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto(server.origin + '/work/vers1ons/licensing/', { waitUntil: 'load' });
  const r = await page.evaluate(() => ({
    width: document.documentElement.scrollWidth,
    lefts: [...document.querySelectorAll('.impact li')].map((li) => Math.round(li.getBoundingClientRect().left)),
  }));
  assert.equal(r.width, 390);
  assert.equal(new Set(r.lefts).size, 1, `the numbers aren't stacked: ${r.lefts}`);
  await ctx.close();
});

test("cards lead with the project's first number: About's My work, the orbit and the Index", async () => {
  const about = await html('/');
  const cards = [...about.matchAll(/<li class="card[^"]*">([\s\S]*?)<\/li>/g)].map((m) => m[1]);
  const impactOf = (title) => cards.find((c) => c.includes(`>${title}</span>`))?.match(/<span class="card-impact[^"]*"><b[^>]*>([^<]+)<\/b>/)?.[1];
  assert.equal(impactOf('vers1ons'), '200+');
  assert.equal(impactOf('Vera'), '48 of 50');
  assert.equal(impactOf('Bespoke'), undefined, 'a concept got a number');
  const work = await html('/work/');
  assert.match(work, /data-impact="200\+ beta users on vers1ons"/);
  assert.match(work, /data-impact="100 releases shipped to Spotify, Apple Music and more"/);
  assert.match(work, /<p class="tagline[^"]*">The licensing marketplace[^<]*<span class="impact[^"]*"><b[^>]*>200\+<\/b>/);
});

test('the orbit caption shows the number of the card pointed at', async () => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(server.origin + '/work/', { waitUntil: 'load' });
  const card = page.locator('.card.cover').first();
  await card.waitFor();
  const b = await card.boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.waitForFunction(() => document.querySelector('[data-c="impact"]')?.textContent === '200+ beta users on vers1ons');
  await ctx.close();
});
