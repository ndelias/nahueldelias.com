// The homepage (/), in Chrome against the shipped build (dist/): Split with
// vers1ons first. Nahuel's column (photo, name, line, links on one row),
// the work with vers1ons leading, about, experience, and the meadow closing
// the page. Readable without JS; complete at once under reduced motion.
// /about redirects here.

import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { launch, serve } from '../../scripts/lib/browser.mjs';

const DIST = join(resolve(import.meta.dirname, '../..'), 'dist');
const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };

let server;
let browser;
before(async () => {
  assert.ok(existsSync(join(DIST, 'work/index.html')), 'No dist/work/. Run `npm run build` first.');
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
// How many pixels a canvas has drawn (any alpha).
const inked = (page, selector) =>
  page.evaluate((s) => {
    const c = document.querySelector(s);
    if (!c.width || !c.height) return 0;
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i]) n++;
    return n;
  }, selector);

test('no placeholder copy; Work and About in the nav on every page; /about lands here', async () => {
  const html = await readFile(join(DIST, 'index.html'), 'utf8');
  assert.ok(!/\[[A-Z][^\]]*\]/.test(html.replace(/<[^>]+>/g, ' ')), 'bracketed placeholder text on /');
  for (const page of ['index.html', 'work/index.html', 'work/vers1ons/index.html', 'studies/bespoke/index.html']) {
    const other = await readFile(join(DIST, page), 'utf8');
    assert.match(other, /<a href="\/work"/, `no Work link on ${page}`);
    assert.match(other, /<a href="\/"/, `no About link on ${page}`);
  }
  const redirect = await readFile(join(DIST, 'about/index.html'), 'utf8');
  assert.match(redirect, /http-equiv="refresh" content="0;url=\/"/);
});

test('the name in the corner leads home; /work carries the resume and Contact, small, bottom right', async () => {
  for (const page of ['index.html', 'work/index.html', 'work/vers1ons/index.html']) {
    const html = await readFile(join(DIST, page), 'utf8');
    assert.match(html, /<a class="name[^"]*"[^>]*href="\/"/, `the name doesn't lead home on ${page}`);
  }
  const work = await readFile(join(DIST, 'work/index.html'), 'utf8');
  const corner = work.match(/<div class="contact[^"]*"[^>]*>([\s\S]*?)<\/div>/)?.[1] ?? '';
  assert.match(corner, /href="\/nahuel-delias-resume\.pdf" target="_blank"/);
  assert.match(corner, /href="mailto:njdelias@gmail\.com"/);
  const hub = await readFile(join(DIST, 'work/vers1ons/index.html'), 'utf8');
  assert.ok(!/class="contact[ "]/.test(hub), 'the corner links show off /work');
});

test('My work: vers1ons first with its parts, then a card for every other project, each to its page', async () => {
  const { ctx, page } = await open({ javaScriptEnabled: false });
  const work = await page.evaluate(() => ({
    lead: [document.querySelector('.feature .title a').textContent.trim(), document.querySelector('.feature .title a').getAttribute('href')],
    parts: [...document.querySelectorAll('.feature .parts a')].map((a) => a.getAttribute('href')),
    cards: [...document.querySelectorAll('a.wc')].map((a) => [a.querySelector('.title').textContent.trim(), a.getAttribute('href')]),
  }));
  assert.deepEqual(work.lead, ['vers1ons', '/work/vers1ons/']);
  assert.equal(work.parts.length, 5);
  assert.ok(work.parts.every((h) => h.startsWith('/work/vers1ons/')), `a part outside vers1ons: ${work.parts}`);
  assert.deepEqual(work.cards, [
    ['Vera', '/work/vera/'],
    ['Sourceline', '/studies/sourceline/'],
    ['Bespoke', '/studies/bespoke/'],
  ]);
  await ctx.close();
});

test('the cards show the product (the rest after the first paint); pointing at one plays its recording in place, muted', async () => {
  // Only vers1ons' frame is in the HTML ready to load; the rest arrive after
  // the first paint, so they can't slow the largest paint on a phone.
  const html = await readFile(join(DIST, 'index.html'), 'utf8');
  assert.equal((html.match(/<img data-later-src=/g) ?? []).length, 3);
  const { ctx, page } = await open();
  await page.waitForFunction(() => !document.querySelector('img[data-later-src]'));
  const stills = await page.evaluate(() => [...document.querySelectorAll('[data-reel] .shot img')].map((i) => new URL(i.currentSrc || i.src, location.href).pathname));
  assert.equal(stills.length, 4);
  assert.ok(stills.every((s) => /\/still\./.test(s)), `a card without a frame of its product: ${stills}`);
  await page.waitForFunction(() => document.querySelector('.cursor-tip'));
  const cards = page.locator('[data-reel]');
  for (const [i, src] of ['/media/vers1ons/reel.mp4', '/media/vera/reel.mp4', '/media/sourceline/reel.mp4', '/media/bespoke/v2-flow.mp4'].entries()) {
    await cards.nth(i).scrollIntoViewIfNeeded();
    await cards.nth(i).hover();
    const state = await page.evaluate(() => {
      const v = document.querySelector('[data-reel] video');
      return v && { src: new URL(v.src).pathname, muted: v.muted, inShot: !!v.closest('.shot') };
    });
    assert.deepEqual(state, { src, muted: true, inShot: true });
  }
  assert.equal(await page.locator('.cursor-tip.on').textContent(), 'Case study');
  await page.mouse.move(5, 5);
  assert.equal(await page.locator('[data-reel] video').count(), 0, 'the recording stayed after the pointer left');
  await ctx.close();
});

test('without JS: the photo, the line, the work, about, experience and the links read plainly', async () => {
  const { ctx, page } = await open({ javaScriptEnabled: false });
  const state = await page.evaluate(() => ({
    h1: document.querySelector('h1').textContent.trim(),
    photo: getComputedStyle(document.querySelector('[data-photo] img')).opacity,
    line: !!document.querySelector('[data-edit="line"]')?.textContent.trim(),
    statement: !!document.querySelector('[data-edit="statement"]')?.textContent.trim(),
    steps: document.querySelectorAll('.steps li').length,
    roles: document.querySelectorAll('.exp .rows li').length,
    links: [...document.querySelectorAll('.side .links a')].map((a) => a.getAttribute('href')),
  }));
  assert.deepEqual(state, {
    h1: "Nahuel D'Elias",
    photo: '1',
    line: true,
    statement: true,
    steps: 5,
    roles: 5,
    links: ['/nahuel-delias-resume.pdf', '/nahuel-delias-resume.pdf', 'https://www.linkedin.com/in/nahuel-d-elias', 'mailto:njdelias@gmail.com', 'https://github.com/ndelias'],
  });
  await ctx.close();
});

test('the photo arrives as characters that settle, then the photo itself', async () => {
  const { ctx, page } = await open();
  await page.waitForFunction(() => document.querySelector('[data-photo][data-settling]'));
  // The first frames are mostly scramble; wait for the characters to fill in.
  await page.waitForFunction(() => {
    const c = document.querySelector('[data-photo] canvas');
    if (!c.width) return false;
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i]) n++;
    return n > 1000;
  }, null, { timeout: 3000 });
  await page.waitForFunction(() => document.querySelector('[data-photo][data-done]'), null, { timeout: 5000 });
  await page.waitForFunction(() => getComputedStyle(document.querySelector('[data-photo] img')).opacity === '1', null, { timeout: 3000 });
  await ctx.close();
});

test('reduced motion: the photo is there at once, and the meadow is still', async () => {
  const { ctx, page } = await open({ reducedMotion: 'reduce' });
  assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('[data-photo] img')).opacity), '1');
  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForFunction(() => document.querySelector('[data-meadow][data-ready]'));
  const still = await page.evaluate(async () => {
    const c = document.querySelector('[data-meadow]');
    const a = c.toDataURL();
    await new Promise((r) => setTimeout(r, 600));
    return a === c.toDataURL();
  });
  assert.ok(still, 'the meadow moves under reduced motion');
  assert.equal(await page.evaluate(() => document.querySelector('[data-photo]').hasAttribute('data-settling')), false);
  await ctx.close();
});

test('the meadow closes the page: not drawn until it comes near, then arrives in pixels and is whole', async () => {
  const { ctx, page } = await open();
  await page.waitForTimeout(1500);
  assert.equal(await page.evaluate(() => document.querySelector('[data-meadow]').width), 300, 'the meadow was built before it came near');
  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForFunction(() => document.querySelector('[data-meadow]').width !== 300);
  await page.waitForFunction(() => document.querySelector('[data-meadow][data-ready]'));
  const whole = await page.evaluate(() => document.querySelector('[data-meadow]').width * document.querySelector('[data-meadow]').height);
  assert.equal(await inked(page, '[data-meadow]'), whole, 'the meadow has holes once it has arrived');
  const box = await page.evaluate(() => {
    const r = document.querySelector('[data-meadow]').getBoundingClientRect();
    return { bottom: Math.round(r.bottom), height: innerHeight };
  });
  assert.ok(box.bottom <= box.height + 1, 'the meadow is not the last thing on the page');
  await ctx.close();
});

test('desktop: the links sit on one row under the line', async () => {
  const { ctx, page } = await open();
  const tops = await page.evaluate(() => [...document.querySelectorAll('.side .links a')].map((a) => Math.round(a.getBoundingClientRect().top)));
  assert.equal(new Set(tops).size, 1, `the links wrap: ${tops}`);
  await ctx.close();
});

test('the resume opens in a new tab and downloads; it is served as a PDF', async () => {
  const { ctx, page } = await open();
  const links = await page.evaluate(() =>
    [...document.querySelectorAll('.side .links a[href$=".pdf"]')].map((a) => ({ target: a.target, download: a.hasAttribute('download') })),
  );
  assert.deepEqual(links, [
    { target: '_blank', download: false },
    { target: '', download: true },
  ]);
  const res = await page.request.get(server.origin + '/nahuel-delias-resume.pdf');
  assert.equal(res.status(), 200);
  assert.ok((await res.body()).subarray(0, 5).toString() === '%PDF-', 'not a PDF');
  await ctx.close();
});

test('phone: a compact row on top, the work right after, the links at the end, nothing off the side', async () => {
  const { ctx, page } = await open({ viewport: PHONE });
  const state = await page.evaluate(() => ({
    photo: Math.round(document.querySelector('[data-photo]').getBoundingClientRect().width),
    photoShown: getComputedStyle(document.querySelector('[data-photo] img')).opacity,
    sideLinks: [...document.querySelectorAll('.side .links a')].some((a) => a.checkVisibility()),
    endLinks: [...document.querySelectorAll('.end .links a')].filter((a) => a.checkVisibility()).length,
    workTop: Math.round(document.querySelector('#work-title').getBoundingClientRect().top),
  }));
  assert.deepEqual({ ...state, workTop: state.workTop < 844 }, { photo: 72, photoShown: '1', sideLinks: false, endLinks: 5, workTop: true });
  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(300);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 390);
  await ctx.close();
});

test('the lines: a thread with a mark at every heading, ending at the meadow, branching into each step', async () => {
  const { ctx, page } = await open();
  await page.waitForFunction(() => document.querySelectorAll('svg.lines').length === 2);
  await page.evaluate(async () => {
    for (let y = 0; y <= document.documentElement.scrollHeight; y += 400) {
      scrollTo(0, y);
      await new Promise((r) => requestAnimationFrame(r));
    }
  });
  await page.waitForTimeout(600);
  const state = await page.evaluate(() => {
    const headings = [...document.querySelectorAll('.flow [data-section] h2, .flow [data-section] h3.label')].filter((h) => h.offsetParent).length;
    const [thread, branches] = [...document.querySelectorAll('svg.lines')];
    const meadow = document.querySelector('[data-meadow]').getBoundingClientRect();
    const head = thread.querySelector('polyline').getBoundingClientRect();
    return {
      headings,
      marks: thread.querySelectorAll('.mark.on').length,
      drawn: Number(thread.querySelector('path').style.strokeDashoffset) < 1,
      headInMeadow: head.top > meadow.top && head.bottom < meadow.bottom,
      branches: branches.querySelectorAll('path').length,
      stepsShown: document.querySelectorAll('.steps li.in').length,
    };
  });
  assert.equal(state.marks, state.headings, 'a heading without its mark');
  assert.ok(state.headings >= 6, `only ${state.headings} headings`);
  assert.ok(state.drawn, 'the thread is not drawn whole at the end of the page');
  assert.ok(state.headInMeadow, 'the thread does not end in the meadow');
  assert.equal(state.branches, 5, 'not a branch into each of the five steps');
  assert.equal(state.stepsShown, 5);
  await ctx.close();
});
