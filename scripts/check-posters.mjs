#!/usr/bin/env node
// Poster budget, for the images most likely to be the largest paint:
// - Strip posters in AVIF: 40KB at 1x, 80KB at 2x (the W01 one is the LCP
//   image on /; the rest load right after it).
// - Case study heroes in AVIF (data-hero sources, width descriptors): 60KB
//   up to 1344 wide (1x of the full-width hero), 120KB at 2688 (2x).
// Reads the AVIF srcsets (and the strip's deferred data-srcset) from the
// built pages, so it checks exactly what ships, and names every file over.
// Fails if it finds no posters or no heroes at all. Dependency-free.

import { readFile, readdir, stat, appendFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const DIST = resolve(process.argv[2] ?? 'dist');
const BUDGET = { '1x': 40_000, '2x': 80_000 }; // bytes
const HERO_BUDGET = (w) => (w <= 1344 ? { label: '1x', bytes: 60_000 } : w <= 2688 ? { label: '2x', bytes: 120_000 } : undefined);
const kb = (n) => `${(n / 1000).toFixed(1)} KB`;

if (!existsSync(DIST)) {
  console.error(`No build at ${DIST}. Run \`npm run build\` first.`);
  process.exit(1);
}

async function pages(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await pages(p)));
    else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
}

const posters = new Map(); // url path → density
const heroes = new Map(); // url path → width
for (const page of await pages(DIST)) {
  const html = await readFile(page, 'utf8');
  for (const [tag] of html.matchAll(/<(?:source|link)\b[^>]*type="image\/avif"[^>]*>/g)) {
    const set = tag.match(/\s(?:data-srcset|srcset|imagesrcset)="([^"]+)"/)?.[1];
    const hero = /\sdata-hero[\s>=]/.test(tag);
    for (const candidate of set?.split(',') ?? []) {
      const [url, descriptor = '1x'] = candidate.trim().split(/\s+/);
      if (hero) heroes.set(url, Number.parseInt(descriptor, 10));
      else posters.set(url, descriptor);
    }
  }
}

const lines = [];
let over = 0;
for (const [url, density] of [...posters].sort()) {
  const budget = BUDGET[density];
  const size = (await stat(join(DIST, url))).size;
  const ok = budget !== undefined && size <= budget;
  if (!ok) over++;
  lines.push(`${ok ? 'ok  ' : 'OVER'}  ${kb(size).padStart(8)} of ${budget === undefined ? `no budget for ${density}` : kb(budget)}  ${density}  ${url}`);
}
let heroesOver = 0;
for (const [url, w] of [...heroes].sort()) {
  const budget = HERO_BUDGET(w);
  const size = (await stat(join(DIST, url))).size;
  const ok = budget !== undefined && size <= budget.bytes;
  if (!ok) heroesOver++;
  lines.push(`${ok ? 'ok  ' : 'OVER'}  ${kb(size).padStart(8)} of ${budget ? kb(budget.bytes) : 'no budget'}  hero ${budget?.label ?? '?'} ${w}w  ${url}`);
}
if (!posters.size) lines.push('FAIL: no AVIF posters found in the built pages');
else lines.push(over ? `FAIL: ${over} poster${over === 1 ? '' : 's'} over budget` : `PASS: ${posters.size} AVIF posters within budget`);
if (!heroes.size) lines.push('FAIL: no AVIF heroes found in the built pages');
else lines.push(heroesOver ? `FAIL: ${heroesOver} hero image${heroesOver === 1 ? '' : 's'} over budget` : `PASS: ${heroes.size} AVIF hero images within budget`);

const fail = over > 0 || !posters.size || heroesOver > 0 || !heroes.size;
(fail ? console.error : console.log)(lines.join('\n'));
if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, `### Poster budget\n\n\`\`\`\n${lines.join('\n')}\n\`\`\`\n`);
process.exit(fail ? 1 : 0);
