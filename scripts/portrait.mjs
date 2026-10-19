#!/usr/bin/env node
// The About page's portrait: a photo turned into a grid of characters, ink on
// the page. Run once per photo; only the grid is committed (the photo stays
// out of the repo and off the site).
//
//   node scripts/portrait.mjs <photo> [out]   (out: src/assets/about/portrait.json)
//
// Cropped to the slot's shape (400×480, a little toward the top), shrunk to
// 80×80 cells. The wall behind is found by color (grey and fairly light),
// filled in from the top and sides only, and never as bright as the shirt; it becomes a sparse grid of dots. The rest is sharpened
// (each cell against its neighbourhood), its brightness stretched over the
// subject alone, and mapped to a ramp of characters, sparse for light and
// dense for dark. Skin sits toward the light end, so hair, brows, glasses and
// beard stand out. sharp comes with Astro.

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import sharp from 'sharp';

const [photo, out = 'src/assets/about/portrait.json'] = process.argv.slice(2);
if (!photo) {
  console.error('Usage: node scripts/portrait.mjs <photo> [out]');
  process.exit(1);
}

const COLS = 80;
const ROWS = 80;
const BOX = 400 / 480; // the slot's shape on the page
const RAMP = ' .:-=+*xzYX%#'; // light → dark, each step visibly denser
const DOT = '·';

const img = sharp(photo);
const { width, height } = await img.metadata();
let sw = width;
let sh = sw / BOX;
if (sh > height) {
  sh = height;
  sw = sh * BOX;
}
const left = Math.round((width - sw) / 2);
const top = Math.round((height - sh) * 0.3);
const { data } = await img
  .extract({ left, top, width: Math.round(sw), height: Math.round(sh) })
  .resize(COLS, ROWS, { fit: 'fill' })
  .removeAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

const N = COLS * ROWS;
const lum = new Float32Array(N);
for (let i = 0; i < N; i++) lum[i] = 0.299 * data[i * 3] + 0.587 * data[i * 3 + 1] + 0.114 * data[i * 3 + 2];

// The wall: grey and fairly light, but not white (skin is warmer, the hair
// darker, the shirt brighter).
const isWall = (i) => {
  const r = data[i * 3];
  const g = data[i * 3 + 1];
  const b = data[i * 3 + 2];
  return Math.max(r, g, b) - Math.min(r, g, b) < 24 && lum[i] > 120 && lum[i] < 222;
};
const bg = new Uint8Array(N);
const stack = [];
for (let x = 0; x < COLS; x++) stack.push(x);
for (let y = 0; y < ROWS * 0.6; y++) stack.push(y * COLS, y * COLS + COLS - 1);
while (stack.length) {
  const i = stack.pop();
  if (bg[i] || !isWall(i)) continue;
  bg[i] = 1;
  const x = i % COLS;
  const y = Math.floor(i / COLS);
  if (x > 0) stack.push(i - 1);
  if (x < COLS - 1) stack.push(i + 1);
  if (y > 0) stack.push(i - COLS);
  if (y < ROWS - 1) stack.push(i + COLS);
}

// Sharpen: each cell against its 3×3 neighbourhood.
const sharp3 = new Float32Array(N);
for (let y = 0; y < ROWS; y++)
  for (let x = 0; x < COLS; x++) {
    let sum = 0;
    let n = 0;
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx;
        const yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= COLS || yy >= ROWS) continue;
        sum += lum[yy * COLS + xx];
        n++;
      }
    const i = y * COLS + x;
    sharp3[i] = lum[i] + 1.4 * (lum[i] - sum / n);
  }

// Stretch over the subject only.
const mine = [...sharp3].filter((_, i) => !bg[i]).sort((a, b) => a - b);
const lo = mine[Math.floor(mine.length * 0.02)];
const hi = mine[Math.floor(mine.length * 0.97)];
const rows = [];
for (let y = 0; y < ROWS; y++) {
  let row = '';
  for (let x = 0; x < COLS; x++) {
    const i = y * COLS + x;
    if (bg[i]) {
      row += x % 2 === 0 && y % 2 === 0 ? DOT : ' ';
      continue;
    }
    const v = Math.min(1, Math.max(0, (sharp3[i] - lo) / (hi - lo)));
    const dark = Math.pow(1 - v, 1.5);
    row += RAMP[Math.max(1, Math.min(RAMP.length - 1, Math.floor(dark * RAMP.length)))];
  }
  rows.push(row);
}

const file = resolve(out);
await mkdir(dirname(file), { recursive: true });
await writeFile(file, JSON.stringify({ cols: COLS, rows: ROWS, grid: rows }, null, 0) + '\n');
console.log(`Wrote ${COLS}×${ROWS} portrait to ${out}`);
