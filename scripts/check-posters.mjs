#!/usr/bin/env node
// Poster budget: every focused-size strip poster in AVIF must stay under
// 40KB at 1x and 80KB at 2x (the W01 one is the LCP image; the rest load
// right after it). Reads the AVIF srcsets (and the strip's deferred
// data-srcset) from the built pages, so it checks exactly what ships, and
// names every file over. Fails if it finds no posters at all. Dependency-free.

import { readFile, readdir, stat, appendFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const DIST = resolve(process.argv[2] ?? 'dist');
const BUDGET = { '1x': 40_000, '2x': 80_000 }; // bytes
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
for (const page of await pages(DIST)) {
  const html = await readFile(page, 'utf8');
  for (const [tag] of html.matchAll(/<(?:source|link)\b[^>]*type="image\/avif"[^>]*>/g)) {
    const set = tag.match(/\s(?:data-srcset|srcset|imagesrcset)="([^"]+)"/)?.[1];
    for (const candidate of set?.split(',') ?? []) {
      const [url, density = '1x'] = candidate.trim().split(/\s+/);
      posters.set(url, density);
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
if (!posters.size) lines.push('FAIL: no AVIF posters found in the built pages');
else lines.push(over ? `FAIL: ${over} poster${over === 1 ? '' : 's'} over budget` : `PASS: ${posters.size} AVIF posters within budget`);

const fail = over > 0 || !posters.size;
(fail ? console.error : console.log)(lines.join('\n'));
if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, `### Poster budget\n\n\`\`\`\n${lines.join('\n')}\n\`\`\`\n`);
process.exit(fail ? 1 : 0);
