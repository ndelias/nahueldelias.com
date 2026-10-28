// /work/vers1ons/money, in Chrome against the shipped build (dist/): the
// page reads in full without JS; the two Preact + Framer Motion islands
// hydrate; the ledger model buys, settles, refuses a second spend and hands
// credit back when a card is declined; reduced motion plays it all at once.
// The hub and Wallet & payouts link to it.

import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { launch, serve } from '../../scripts/lib/browser.mjs';

const DIST = join(resolve(import.meta.dirname, '../..'), 'dist');
const PATH = '/work/vers1ons/money/';

let server;
let browser;
before(async () => {
  assert.ok(existsSync(join(DIST, PATH, 'index.html')), 'No money page in dist/. Run `npm run build` first.');
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
  return { ctx, page };
}
// Scroll the model into view (it hydrates when visible) and wait for it.
async function ledger(page) {
  await page.locator('#ledger').scrollIntoViewIfNeeded();
  await page.waitForFunction(() => !document.querySelector('astro-island[component-url*="LedgerSim"]')?.hasAttribute('ssr'));
}
const events = (page) => page.evaluate(() => [...document.querySelectorAll('.log li')].map((li) => li.textContent.trim()));
const rows = (page) => page.evaluate(() => [...document.querySelectorAll('.ledger tbody tr')].map((tr) => [...tr.children].map((td) => td.textContent.trim())));

test('without JS: the whole story reads, the map and the ledger included', async () => {
  const { ctx, page } = await open({ javaScriptEnabled: false });
  const state = await page.evaluate(() => ({
    h1: document.querySelector('h1').textContent.trim(),
    sections: [...document.querySelectorAll('main h2')].map((h) => h.textContent.trim()),
    payees: document.querySelectorAll('.payees li').length,
    guarantees: document.querySelectorAll('.guarantees li').length,
    buy: !!document.querySelector('.sim button'),
  }));
  assert.deepEqual(state, {
    h1: 'How money moves through vers1ons',
    sections: ['Everyone who gets paid', 'One purchase, in the ledger', "Why it can't spend twice", 'Getting co-writers paid', 'Drops, with rules the server keeps', 'Built to the same standard'],
    payees: 4,
    guarantees: 8,
    buy: true,
  });
  await ctx.close();
});

test('credit covers part: credit first, the card for the rest, settled once, then the license', async () => {
  const { ctx, page } = await open({ reducedMotion: 'reduce' });
  await ledger(page);
  await page.getByRole('button', { name: 'Buy the license' }).click();
  await page.waitForFunction(() => document.querySelectorAll('.log li').length >= 5);
  const log = await events(page);
  assert.match(log[1], /\$25\.00 of credit taken first/);
  assert.match(log[2], /Card charged \$44\.00/);
  assert.match(log.at(-1), /Settled once/);
  assert.deepEqual((await rows(page)).map((r) => [r[0], r[2], r[3]]), [
    ['Grant', '+$25.00', 'Settled'],
    ['Spend', '-$25.00', 'Settled'],
  ]);
  await page.getByRole('button', { name: 'Spend it twice' }).click();
  assert.match((await events(page)).at(-1), /refused by the database/);
  assert.equal((await rows(page)).length, 2, 'a second spend reached the ledger');
  await ctx.close();
});

test('a declined card ends the sale and hands the exact credit back', async () => {
  const { ctx, page } = await open({ reducedMotion: 'reduce' });
  await ledger(page);
  await page.getByRole('button', { name: 'Buy, card declined' }).click();
  await page.waitForFunction(() => /Sale ended/.test(document.querySelector('.log li:last-child')?.textContent ?? ''));
  assert.deepEqual((await rows(page)).map((r) => [r[0], r[2], r[3]]), [
    ['Grant', '+$25.00', 'Settled'],
    ['Spend', '-$25.00', 'Reversed'],
    ['Reversal', '+$25.00', 'Settled'],
  ]);
  assert.equal(await page.evaluate(() => document.querySelector('.ledger tfoot td').textContent.trim()), '$25.00');
  await ctx.close();
});

test('credit alone: no charge to wait for, the sale settles as its own event', async () => {
  const { ctx, page } = await open({ reducedMotion: 'reduce' });
  await ledger(page);
  await page.getByRole('button', { name: 'Credit covers it' }).click();
  await page.getByRole('button', { name: 'Buy the license' }).click();
  await page.waitForFunction(() => /Settled once/.test(document.querySelector('.log li:last-child')?.textContent ?? ''));
  const log = await events(page);
  assert.ok(!log.some((l) => /Card/.test(l)), 'a card was charged');
  assert.ok(log.some((l) => /settles as its own event/.test(l)));
  await ctx.close();
});

test('the hub features it in a card above the parts', async () => {
  const html = await readFile(join(DIST, 'work/vers1ons/index.html'), 'utf8');
  const card = html.match(/<a class="feature[^"]*" href="([^"]+)"[\s\S]*?<\/a>/);
  assert.ok(card, 'no featured card on the hub');
  assert.equal(card[1], PATH);
  assert.match(card[0], /How money moves through vers1ons/);
  assert.ok(html.indexOf('class="feature') < html.indexOf('class="parts defer'), 'the card is not above the parts');
});

test('/work lists it under vers1ons as W01.$: in the orbit with the parts, and in the Index', async () => {
  const html = await readFile(join(DIST, 'work/index.html'), 'utf8');
  const card = html.match(/<a[^>]*class="card part[^"]*"[^>]*>/g)?.find((a) => a.includes(`href="${PATH}"`));
  assert.ok(card, 'no Money card in the orbit');
  assert.match(card, /data-kicker="Money, end to end"/);
  assert.match(card, /data-no="W01\.\$"/);
  assert.match(card, /data-video="\/media\/vers1ons\/money\/walkthrough\.mp4"/);
  assert.match(html, new RegExp(`<a class="sub-title[^"]*" href="${PATH}">Money, end to end</a>`), 'no Money line in the Index');
});

test('the hub and Wallet & payouts link here', async () => {
  for (const page of ['work/vers1ons/index.html', 'work/vers1ons/wallet-payouts/index.html']) {
    const html = await readFile(join(DIST, page), 'utf8');
    assert.match(html, /href="\/work\/vers1ons\/money\/"/, `no link from ${page}`);
  }
});

test('phone: nothing runs off the side', async () => {
  const { ctx, page } = await open({ viewport: { width: 390, height: 844 } });
  await ledger(page);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 390);
  await ctx.close();
});
