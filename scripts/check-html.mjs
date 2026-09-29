#!/usr/bin/env node
// HTML budget: every built page's HTML must stay under 13.6KB gzipped. The
// HTML carries the page's CSS inline (astro.config.mjs) and is the one
// request every page's first paint waits on, so its size is the floor of
// every LCP. The gate is about 20% above the largest page when it was set
// (Distribution, 11.4KB on 2026-09-29); raise it on purpose, in CLAUDE.md
// too, not to make a page fit. Gzip at the default level, like the JS
// budget: Vercel serves brotli where it can, which is smaller.
// Dependency-free.

import { readFile, readdir, appendFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { gzipSync } from 'node:zlib';

const BUDGET = 13_600; // bytes, gzipped
const DIST = resolve(process.argv[2] ?? 'dist');
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

const sizes = [];
for (const file of await pages(DIST)) {
  const path = '/' + relative(DIST, file).split(sep).join('/').replace(/index\.html$/, '');
  sizes.push({ path, gzip: gzipSync(await readFile(file)).length });
}
sizes.sort((a, b) => b.gzip - a.gzip);

const over = sizes.filter((s) => s.gzip > BUDGET);
const lines = sizes.map((s) => `${s.gzip > BUDGET ? 'OVER' : 'ok  '}  ${kb(s.gzip).padStart(8)}  ${s.path}`);
lines.push(
  over.length
    ? `FAIL: ${over.map((s) => `${s.path} is ${kb(s.gzip)}`).join(', ')}, over the ${kb(BUDGET)} HTML budget`
    : `PASS: ${sizes.length} pages under the ${kb(BUDGET)} HTML budget (largest ${sizes[0].path}, ${kb(sizes[0].gzip)})`,
);
(over.length ? console.error : console.log)(lines.join('\n'));
if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, `### HTML budget\n\n\`\`\`\n${lines.join('\n')}\n\`\`\`\n`);
process.exit(over.length ? 1 : 0);
