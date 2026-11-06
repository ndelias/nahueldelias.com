// /studies/sourceline (the comps study), in Chrome against the shipped build (dist/): the page and
// its three tables read without JS; the fill lands every number, the blank
// that needs the analyst last, without moving the page below; the trace
// opens a number's source from the keyboard and Escape puts focus back; the
// correction recounts the multiples and says what moved; on a phone the
// source opens under the row and nothing runs off the side. While the
// tables say they're sample numbers, the homepage and /work don't list it.
//
// The checks read their expectations from the page where they can, so they
// hold when the sample numbers give way to the real ones.

import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { launch, serve } from '../../scripts/lib/browser.mjs';

const DIST = join(resolve(import.meta.dirname, '../..'), 'dist');
const PATH = '/studies/sourceline/';

let server;
let browser;
before(async () => {
  assert.ok(existsSync(join(DIST, PATH, 'index.html')), 'No comps page in dist/. Run `npm run build` first.');
  server = await serve(DIST);
  browser = await launch();
});
after(async () => {
  await browser?.close();
  await server?.close();
});

async function open(options = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...options });
  const page = await ctx.newPage();
  await page.goto(server.origin + PATH, { waitUntil: 'load' });
  // The tables' styles arrive after the first paint (DeferredStyles), and
  // the page settles to its real heights then. Scroll only after that.
  if (options.javaScriptEnabled !== false) {
    await page.waitForFunction(() => [...document.styleSheets].some((s) => s.href?.includes('deferred')));
  }
  return { ctx, page };
}
// Scroll a piece into view (it hydrates when visible) and wait for it.
async function piece(page, name) {
  const section = page.locator(`.comps-${name}`);
  await section.scrollIntoViewIfNeeded();
  await page.waitForFunction((n) => !document.querySelector(`.comps-${n}`)?.closest('astro-island')?.hasAttribute('ssr'), name);
  return section;
}
const summary = (section) =>
  section.evaluate((s) => Object.fromEntries([...s.querySelectorAll('.summary li')].map((li) => [li.textContent.replace(/[\d\s]+/, '').trim(), Number(li.querySelector('b').textContent)])));

test('without JS: every section and all three tables read', async () => {
  const { ctx, page } = await open({ javaScriptEnabled: false });
  const state = await page.evaluate(() => ({
    h1: document.querySelector('h1').textContent.trim(),
    tables: [...document.querySelectorAll('.comps table')].map((t) => t.querySelectorAll('tbody th').length),
    traced: [...document.querySelectorAll('.comps-trace tbody .face')].length,
  }));
  assert.equal(state.h1, 'Sourceline');
  assert.deepEqual(state.tables, [5, 5, 5]);
  assert.ok(state.traced >= 15, 'the trace table has no numbers without JS');
  await ctx.close();
});

test('reduced motion: the fill shows the finished table at once and says so', async () => {
  const { ctx, page } = await open({ reducedMotion: 'reduce' });
  const fill = await piece(page, 'fill');
  await page.waitForFunction(() => /Table filled/.test(document.querySelector('.comps-fill [aria-live]').textContent));
  const counts = await summary(fill);
  assert.ok(counts['needs you'] >= 1, 'nothing needs the analyst');
  assert.equal(await fill.locator('tbody .needs').count(), counts['needs you']);
  assert.equal(await fill.locator('tbody .face').count(), 20);
  await ctx.close();
});

test('the fill lands every number once in view, and the page below never moves', async () => {
  const { ctx, page } = await open();
  const fill = page.locator('.comps-fill');
  await fill.scrollIntoViewIfNeeded();
  const below = () => page.evaluate(() => document.querySelector('.comps-fill').closest('astro-island').nextElementSibling.getBoundingClientRect().top + scrollY);
  const top = await below();
  await page.waitForFunction(() => document.querySelector('.comps-fill tbody .needs'), null, { timeout: 6000 });
  await page.waitForFunction(() => /Table filled/.test(document.querySelector('.comps-fill [aria-live]').textContent));
  assert.equal(await below(), top, 'the fill moved the page below it');
  // The blank lands last: by then every other number is in.
  assert.equal(await fill.locator('tbody .face').count(), 20);
  await ctx.close();
});

test('the trace: arrow keys reach a number, Enter opens its source, Escape puts focus back', async () => {
  const { ctx, page } = await open({ reducedMotion: 'reduce' });
  const trace = await piece(page, 'trace');
  await trace.locator('tbody button.cell').first().focus();
  for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowRight');
  const label = await page.evaluate(() => document.activeElement.getAttribute('aria-label'));
  assert.match(label, /^Toast LTM adj\. EBITDA: [\d.]+, adjusted, footnote 1$/);
  await page.keyboard.press('Enter');
  const panel = trace.locator('.panel .source');
  await panel.waitFor();
  assert.match(await panel.locator('.what').textContent(), /^Toast adj\. EBITDA/);
  assert.equal(await panel.locator('[aria-current="true"]').count(), 1, 'no line highlighted');
  await page.keyboard.press('Escape');
  await trace.locator('.panel .empty').waitFor();
  assert.equal(await page.evaluate(() => document.activeElement.getAttribute('aria-label')), label);
  await ctx.close();
});

test('the correction: a number for the blank recounts the multiples and says what moved', async () => {
  const { ctx, page } = await open({ reducedMotion: 'reduce' });
  const correct = await piece(page, 'correct');
  const before = await summary(correct);
  const notes = await correct.locator('.notes li').count();
  const blank = correct.locator('tbody button.cell', { has: page.locator('.needs') }).first();
  const who = (await blank.getAttribute('aria-label')).split(' LTM')[0];
  await blank.click();
  await correct.getByRole('button', { name: 'Enter a number' }).click();
  const input = correct.getByLabel('LTM adj. EBITDA, $bn');
  await input.fill('nope');
  await correct.getByRole('button', { name: 'Apply' }).click();
  assert.match(await correct.locator('.error').textContent(), /Enter a number in billions/);
  await input.fill('8.1');
  await correct.getByRole('button', { name: 'Apply' }).click();
  await page.waitForFunction(() => /is now/.test(document.querySelector('.comps-correct [aria-live]').textContent));
  const said = await correct.locator('[aria-live]').textContent();
  assert.match(said, new RegExp(`^${who} EV / EBITDA is now [\\d.]+x\\. Peer median EV / EBITDA moved from`));
  const after = await summary(correct);
  assert.equal(after['needs you'], before['needs you'] - 1);
  assert.equal(after['by you'], 1);
  assert.equal(await correct.locator('.notes li').count(), notes + 1);
  assert.ok(await correct.locator('.notes').textContent().then((t) => t.includes(`${who} LTM adj. EBITDA: entered by you.`)));
  // Focus goes back to the number once the entry is gone.
  await page.waitForFunction((w) => document.activeElement.getAttribute('aria-label')?.startsWith(`${w} LTM adj. EBITDA: 8.10, set by you`), who);
  await correct.getByRole('button', { name: 'Start over' }).click();
  assert.deepEqual(await summary(correct), before);
  await ctx.close();
});

test('phone: the source opens under the row, and nothing runs off the side', async () => {
  const { ctx, page } = await open({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const trace = await piece(page, 'trace');
  await trace.locator('tbody button.cell').nth(1).click();
  const push = trace.locator('tbody tr.push');
  await push.waitFor();
  assert.equal(await push.evaluate((tr) => tr.previousElementSibling.querySelector('th').textContent.startsWith('Toast')), true);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 390);
  await ctx.close();
});

test('while the tables show sample numbers, the homepage and /work leave it out', async () => {
  const html = await readFile(join(DIST, PATH, 'index.html'), 'utf8');
  if (!/sample numbers, not real/.test(html)) return;
  for (const listing of ['index.html', 'work/index.html']) {
    const page = await readFile(join(DIST, listing), 'utf8');
    assert.ok(!page.includes(`href="${PATH}"`), `${listing} links to a page of sample numbers`);
  }
});
