// src/lib/scope-css.ts is a small hand-written scoper for /motion's stage
// styles: it prefixes every selector and leaves @keyframes steps alone. It
// doesn't parse strings or split :is()/:where() lists, so this checks that
// every stage's CSS stays inside what it handles, and that what comes out is
// scoped all the way through.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { globSync, readFileSync } from 'node:fs';
import { scopeCss } from '../src/lib/scope-css.ts';

const SCOPE = "[data-piece='x']";
const files = globSync('src/motion/*/stage.css');

test('every stage has its CSS file', () => {
  assert.ok(files.length > 0);
});

test('stage CSS stays inside what the scoper handles', () => {
  for (const f of files) {
    const css = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    assert.doesNotMatch(css, /:(is|where|not|has)\([^)]*,/, `${f}: a comma inside :is()/:where()/:not()/:has() would be split`);
    assert.doesNotMatch(css, /(["'])[^"'\n]*[{}][^"'\n]*\1/, `${f}: a brace inside a string would end a rule`);
    assert.doesNotMatch(css, /@(import|layer|container|scope)\b/, `${f}: an at-rule the scoper doesn't know`);
  }
});

test('every selector comes out scoped; keyframe steps are left alone', () => {
  for (const f of files) {
    const out = scopeCss(readFileSync(f, 'utf8'), SCOPE);
    let inKeyframes = 0;
    for (const m of out.matchAll(/([^{}]*)\{/g)) {
      const prelude = m[1].trim();
      if (prelude.startsWith('@')) {
        if (/keyframes/.test(prelude)) inKeyframes = 1;
        continue;
      }
      if (inKeyframes && /^(from|to|[\d.%,\s]+)$/.test(prelude)) continue;
      inKeyframes = 0;
      for (const sel of prelude.split(',')) assert.ok(sel.startsWith(SCOPE), `${f}: "${sel}" isn't scoped`);
    }
  }
  assert.equal(scopeCss('.a,.b{color:red}@media (x){.c{top:0}}@keyframes k{0%,100%{opacity:0}}', 'S'), 'S .a,S .b{color:red}@media (x){S .c{top:0}}@keyframes k{0%,100%{opacity:0}}');
});
