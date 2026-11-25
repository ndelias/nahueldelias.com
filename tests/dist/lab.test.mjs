// The design lab (src/lab/, /_lab) runs in development only: nothing of it
// ships in the production build (dist/).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const DIST = join(resolve(import.meta.dirname, '../..'), 'dist');

test('no lab pages in the build', () => {
  assert.ok(existsSync(join(DIST, 'index.html')), 'No dist/. Run `npm run build` first.');
  assert.equal(existsSync(join(DIST, '_lab')), false, 'dist/_lab exists');
});

test("no page links to the lab or carries its cursor tip", async () => {
  const pages = (await readdir(DIST, { recursive: true })).filter((f) => f.endsWith('.html'));
  for (const page of pages) {
    const html = await readFile(join(DIST, page), 'utf8');
    assert.doesNotMatch(html, /\/_lab\b/, `${page} links to the lab`);
    assert.doesNotMatch(html, /lab-tip/, `${page} carries the lab's styles`);
  }
});
