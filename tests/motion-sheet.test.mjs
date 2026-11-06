// src/lib/sheet.ts places /motion's tiles the way CSS grid's auto-placement
// does and reports gaps, which fail the build (src/lib/motion.ts). This
// checks the placement against what the grid does, and that the pieces as
// they are leave no gap.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { globSync, readFileSync } from 'node:fs';
import { HEADER, pack, parseSize } from '../src/lib/sheet.ts';

const s = (size) => parseSize(size);

test('rows that add up to twelve leave no gap', () => {
  assert.deepEqual(pack([HEADER, s('6x1'), s('6x1'), s('7x2'), s('5x2')]), []);
});

test('two one-row tiles stack beside a two-row tile', () => {
  assert.deepEqual(pack([s('8x2'), s('4x1'), s('4x1'), s('12x1')]), []);
});

test("a tile that doesn't fit leaves a gap, and the gap names it", () => {
  assert.deepEqual(pack([s('6x2'), s('4x2'), s('3x2')]), [{ row: 1, from: 11, to: 12, before: 2 }, { row: 2, from: 11, to: 12, before: 2 }]);
});

test('the last row may be short', () => {
  assert.deepEqual(pack([s('12x1'), s('5x2')]), []);
});

test('a size outside the sheet is refused', () => {
  assert.throws(() => parseSize('2x1'), /isn't a size/);
  assert.throws(() => parseSize('4x3'), /isn't a size/);
  assert.throws(() => parseSize('13x1'), /isn't a size/);
});

test('the pieces as they are fill every row but the last', () => {
  const pieces = globSync('src/content/motion/*.mdx')
    .map((f) => readFileSync(f, 'utf8'))
    .map((src) => ({ number: Number(/^number: (\d+)/m.exec(src)[1]), size: /^size: '([^']+)'/m.exec(src)[1] }))
    .sort((a, b) => a.number - b.number);
  assert.deepEqual(pack([HEADER, ...pieces.map((p) => s(p.size))]), []);
});
