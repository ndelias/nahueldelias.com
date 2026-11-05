// Astro integration: after the build, writes each /motion piece's size into
// its label. The page renders <span data-size-of="/_astro/piece.….js">; this
// gzips that file (the same measure as check-js-budget.mjs, conservative next
// to the brotli Vercel serves) and puts the size in the span, so a label can
// never disagree with what the piece loads. Fails the build when a file is
// missing.

import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const SPAN = /<span data-size-of="([^"]+)"[^>]*>[^<]*<\/span>/g;

async function htmlFiles(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await htmlFiles(p)));
    else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
}

export const formatSize = (bytes) => (bytes < 10_240 ? `${(bytes / 1024).toFixed(1)} KB` : `${Math.round(bytes / 1024)} KB`);

export default function motionSizes() {
  return {
    name: 'motion-sizes',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        const root = fileURLToPath(dir);
        for (const file of await htmlFiles(root)) {
          const html = await readFile(file, 'utf8');
          if (!html.includes('data-size-of=')) continue;
          const sizes = new Map();
          for (const [, src] of html.matchAll(SPAN)) {
            const bytes = gzipSync(await readFile(join(root, src))).length;
            sizes.set(src, bytes);
            logger.info(`${src} ${formatSize(bytes)} gzip`);
          }
          const out = html.replace(SPAN, (_, src) => `<span>${formatSize(sizes.get(src))}</span>`);
          if (out.includes('data-size-of=')) throw new Error(`motion-sizes: a size label in ${file} wasn't filled in.`);
          await writeFile(file, out);
        }
      },
    },
  };
}
