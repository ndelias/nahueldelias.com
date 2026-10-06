#!/usr/bin/env node
// Every file in dist/ is something a page uses. Fails, naming each file, when
// the build ships one that no page references: a source image Astro kept, a
// stray public/ file, a test asset.
//
// Pages (.html) are the roots. From each: src, href, srcset (and the data-
// forms the strip swaps in later), imagesrcset, poster and content
// attributes, and url() and import specifiers in inline CSS and scripts.
// Referenced CSS and JS files are followed for the same. Dependency-free.

import { readFile, readdir, appendFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

const DIST = resolve(process.argv[2] ?? 'dist');
if (!existsSync(DIST)) {
  console.error(`No build at ${DIST}. Run \`npm run build\` first.`);
  process.exit(1);
}

async function walk(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else out.push(p);
  }
  return out;
}

const toUrlPath = (file) => '/' + relative(DIST, file).split(sep).join('/');
const files = new Set((await walk(DIST)).map(toUrlPath));
const pages = [...files].filter((f) => f.endsWith('.html'));

const ATTR = /\s(?:src|href|data-src|data-[\w-]*-url|poster|content)\s*=\s*["']([^"']+)["']/gi;
// Files listed in a JSON file a page fetches (a gallery's screens.json).
const JSON_URL = /"(?:full|src)":"([^"]+)"/g;
const SRCSET = /\s(?:srcset|data-srcset|imagesrcset)\s*=\s*["']([^"']+)["']/gi;
const CSS_URL = /url\(\s*["']?([^"')]+)["']?\s*\)/gi;
const IMPORT = /(?:\bimport\s*\(\s*|(?:^|[;\s}])(?:import|export)\s*(?:[\w$*{}\s,]*?\bfrom\s*)?)["']([^"']+)["']/g;
// Scripts added after load (AfterLoad.astro): their URL is a string literal.
const AFTER_LOAD = /\bsrc = "(\/_astro\/[^"]+\.js)"/g;

function refs(text, isHtml) {
  const out = [];
  if (isHtml) {
    for (const [, v] of text.matchAll(ATTR)) out.push(v);
    for (const [, v] of text.matchAll(SRCSET)) out.push(...v.split(',').map((c) => c.trim().split(/\s+/)[0]));
  }
  for (const [, v] of text.matchAll(CSS_URL)) out.push(v);
  for (const [, v] of text.matchAll(IMPORT)) out.push(v);
  for (const [, v] of text.matchAll(AFTER_LOAD)) out.push(v);
  for (const [, v] of text.matchAll(JSON_URL)) out.push(v);
  return out;
}

function resolveRef(ref, from) {
  if (!ref || /^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(ref)) return null; // data:, https:, mailto:, anchors
  let path = new URL(ref, `https://x${from}`).pathname;
  path = decodeURIComponent(path);
  if (files.has(path)) return path;
  for (const candidate of [path.replace(/\/?$/, '/index.html'), `${path}.html`]) if (files.has(candidate)) return candidate;
  return null;
}

const used = new Set(pages);
const queue = [...pages];
while (queue.length) {
  const file = queue.shift();
  if (!/\.(html|css|js|mjs|json)$/.test(file)) continue;
  const text = await readFile(join(DIST, file), 'utf8');
  for (const ref of refs(text, file.endsWith('.html'))) {
    const path = resolveRef(ref, file);
    if (path && !used.has(path)) {
      used.add(path);
      queue.push(path);
    }
  }
}

const unused = [...files].filter((f) => !used.has(f)).sort();
const lines = unused.length
  ? [`FAIL: ${unused.length} file${unused.length === 1 ? '' : 's'} in dist/ that no page references:`, ...unused.map((f) => `  ${f}`)]
  : [`PASS: all ${files.size} files in dist/ are referenced by one of ${pages.length} pages`];
(unused.length ? console.error : console.log)(lines.join('\n'));
if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, `### Unreferenced files in dist/\n\n\`\`\`\n${lines.join('\n')}\n\`\`\`\n`);
process.exit(unused.length ? 1 : 0);
