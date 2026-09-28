// §6: every text/background pair passes WCAG AA in both themes, computed from
// the token file itself so a color change can't slip past.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PAIRS, checkPairs, contrast, parseColorTokens } from '../src/lib/contrast.mjs';

const ROOT = resolve(import.meta.dirname, '..');
const css = await readFile(resolve(ROOT, 'src/styles/tokens.css'), 'utf8');
const tokens = parseColorTokens(css);

test('the ratio math matches WCAG reference values', () => {
  assert.equal(contrast('#000000', '#FFFFFF'), 21);
  assert.equal(contrast('#FFFFFF', '#FFFFFF'), 1);
  assert.equal(contrast('#767676', '#FFFFFF').toFixed(2), '4.54');
});

test('every color token used in a pair is declared with a light and a dark value', () => {
  // A token the parser can't read would otherwise drop out of the check silently.
  for (const name of new Set(PAIRS.flatMap((p) => [p.fg, p.bg]))) {
    assert.ok(tokens.has(name), `--${name} must be declared as light-dark(#hex, #hex) in tokens.css`);
  }
});

test('every text/background pair passes WCAG AA in both themes', () => {
  const results = checkPairs(tokens);
  const table = results
    .map((r) => `  ${r.pass ? 'pass' : 'FAIL'}  ${r.theme.padEnd(5)}  ${r.fg} on ${r.bg}`.padEnd(40) + `${r.ratio.toFixed(2)}:1 (min ${r.min})`)
    .join('\n');
  const failed = results.filter((r) => !r.pass);
  assert.equal(failed.length, 0, `Contrast below AA:\n${table}`);
  console.log(table);
});
