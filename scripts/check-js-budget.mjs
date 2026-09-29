#!/usr/bin/env node
// §6 budget: JS shipped on each page must stay under 100KB compressed. The
// brief sets it for `/`; it applies to every built page, each on its own.
//
// Counts everything a page loads without user action: <script> tags (external and
// inline), modulepreload links, Astro island component/renderer URLs, and every
// module they import statically. Dynamic import() targets are listed but not
// counted, since they only load on demand.
//
// Sizes are gzip at the default level. Vercel serves brotli where it can, which
// is smaller, so gzip is the conservative measure.

import { readFile, readdir, appendFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { gzipSync, brotliCompressSync } from 'node:zlib';

const BUDGET = 100_000; // bytes, compressed
const DIST = resolve(process.argv[2] ?? 'dist');

if (!existsSync(join(DIST, 'index.html'))) {
  console.error(`No build found at ${join(DIST, 'index.html')}. Run \`npm run build\` first.`);
  process.exit(1);
}

async function htmlPages(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await htmlPages(p)));
    else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
}

const attr = (tag, name) => tag.match(new RegExp(`\\s${name}\\s*=\\s*["']([^"']+)["']`, 'i'))?.[1];
const isLocal = (url) => !/^(?:[a-z]+:)?\/\//i.test(url);
const toPath = (url, from) => new URL(url, `https://x${from}`).pathname;

const STATIC_IMPORT = /(?:^|[;\s}])(?:import|export)\s*(?:[\w$*{}\s,]*?\bfrom\s*)?["']([^"']+)["']/g;
const DYNAMIC_IMPORT = /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g;
const measure = (buf) => ({ gzip: gzipSync(buf).length, brotli: brotliCompressSync(buf).length });

/** Everything one page loads without user action. */
async function measurePage(PAGE, html) {
  const entries = new Set(); // URL paths of JS files loaded eagerly
  const inline = []; // inline script bodies
  const external = []; // cross-origin scripts: fail loudly, we can't measure them

  for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const [, attrs, body] = m;
    const type = attr(`<s ${attrs}`, 'type');
    if (type && !/^(module|text\/javascript|application\/javascript)$/i.test(type)) continue;
    const src = attr(`<s ${attrs}`, 'src');
    if (src) (isLocal(src) ? entries.add(toPath(src, PAGE)) : external.push(src));
    else if (body.trim()) inline.push(body);
  }
  for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
    if (!/rel\s*=\s*["']?modulepreload/i.test(m[0])) continue;
    const href = attr(m[0], 'href');
    if (href) (isLocal(href) ? entries.add(toPath(href, PAGE)) : external.push(href));
  }
  for (const m of html.matchAll(/<astro-island\b[^>]*>/gi)) {
    for (const name of ['component-url', 'renderer-url', 'before-hydration-url']) {
      const url = attr(m[0], name);
      if (url) entries.add(toPath(url, PAGE));
    }
  }

  const files = new Map(); // path -> { gzip, brotli }
  const lazy = new Set();
  const queue = [...entries];
  const scan = (code, from) => {
    for (const [, spec] of code.matchAll(STATIC_IMPORT)) if (isLocal(spec)) queue.push(toPath(spec, from));
    for (const [, spec] of code.matchAll(DYNAMIC_IMPORT)) if (isLocal(spec)) lazy.add(toPath(spec, from));
  };

  inline.forEach((body, i) => {
    files.set(`<inline #${i + 1}>`, measure(Buffer.from(body)));
    scan(body, PAGE);
  });

  while (queue.length) {
    const path = queue.shift();
    if (files.has(path)) continue;
    const file = join(DIST, path);
    if (!existsSync(file)) {
      console.error(`Referenced script not found in build: ${path} (from ${PAGE})`);
      process.exit(1);
    }
    const buf = await readFile(file);
    files.set(path, measure(buf));
    scan(buf.toString('utf8'), path);
  }
  for (const path of files.keys()) lazy.delete(path);
  const total = [...files.values()].reduce((a, f) => ({ gzip: a.gzip + f.gzip, brotli: a.brotli + f.brotli }), { gzip: 0, brotli: 0 });
  return { files, lazy, external, total };
}

const kb = (n) => `${(n / 1000).toFixed(1)} KB`;
const lines = [];
let pass = true;
for (const file of (await htmlPages(DIST)).sort()) {
  const PAGE = '/' + relative(DIST, file).split(sep).join('/').replace(/index\.html$/, '');
  const { files, lazy, external, total } = await measurePage(PAGE, await readFile(file, 'utf8'));
  const ok = total.gzip < BUDGET && external.length === 0;
  pass &&= ok;
  lines.push(`${ok ? 'PASS' : 'FAIL'}  JS on ${PAGE}: ${kb(total.gzip)} gzip (${kb(total.brotli)} brotli) of ${kb(BUDGET)} budget`);
  for (const [path, f] of [...files].sort((a, b) => b[1].gzip - a[1].gzip)) lines.push(`  ${kb(f.gzip).padStart(9)}  ${path}`);
  if (lazy.size) lines.push(`  Lazy (dynamic import, not counted): ${[...lazy].join(', ')}`);
  if (external.length) lines.push(`  Cross-origin scripts can't be measured and aren't allowed: ${external.join(', ')}`);
  if (!ok && total.gzip >= BUDGET) lines.push(`  over budget by ${kb(total.gzip - BUDGET + 1)}`);
}
lines.push(pass ? 'PASS: every page is under budget' : 'FAIL: a page is over budget');

(pass ? console.log : console.error)(lines.join('\n'));
if (process.env.GITHUB_STEP_SUMMARY) {
  await appendFile(process.env.GITHUB_STEP_SUMMARY, `### JS budget, per page\n\n\`\`\`\n${lines.join('\n')}\n\`\`\`\n`);
}
process.exit(pass ? 0 : 1);
