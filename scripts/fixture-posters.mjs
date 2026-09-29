#!/usr/bin/env node
// Placeholder posters for the fixture entries: one tone per entry and theme,
// from docs/design/reference/home.html (TONES), at 2x the focused frame
// (1040×650, 16:10). Also raster heroes for the case study pages Lighthouse
// measures (HEROES), at 2x the full-width hero, so the hero's AVIF path and
// its budget run on something shaped like a real screenshot. Astro's <Picture> turns them into AVIF and WebP at 1x
// and 2x. Generated, not committed: npm runs this before dev, build and
// typecheck, and the output is the same every time (seeded). PNGs need no
// image library: this writes them with zlib.
//
// Each tone carries a faint, soft grain (±GRAIN levels, below what the
// screenshot comparisons count as a difference). A flat tone compresses to a
// few hundred bytes, and Chrome doesn't count an image under 0.05 bits per
// pixel as the largest contentful paint; a real screenshot is well above
// that. With the grain the 1x AVIF is ~1.7KB, about 0.08 bits per pixel, so
// the placeholder behaves like the real poster. Soft grain doesn't compress
// as PNG (~100KB each), which is why these aren't in git.
//
//   node scripts/fixture-posters.mjs   writes src/assets/fixtures/posters/

import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { deflateSync } from 'node:zlib';

const OUT = resolve(import.meta.dirname, '../src/assets/fixtures/posters');
const WIDTH = 1040;
const HEIGHT = 650;
const POSTER_GRAIN = 3;
// Values on an 8px lattice, eased between: single-pixel grain averages out
// when the 1x is scaled down, and hard cells read as a mosaic.
const POSTER_GRAIN_SIZE = 8;
// Heroes get coarser, stronger grain: at the 672 a phone loads, the poster
// grain compresses below 0.05 bits per pixel and Chrome wouldn't count the
// hero as the largest paint, which a real screenshot always is. This keeps
// every hero size above ~0.1.
const HERO_GRAIN = 8;
const HERO_GRAIN_SIZE = 4;

// Homepage order, as in the reference: [slug, light, dark].
const TONES = [
  ['vers1ons', '#CFC9BE', '#34302A'],
  ['blast-radius', '#C3C8CF', '#2C3037'],
  ['bespoke', '#D6CCBF', '#3A332B'],
  ['city-social-club', '#C8CDC2', '#2E332C'],
  ['app-teardown', '#D0CDD6', '#322F38'],
  ['data-project', '#CBC3B8', '#37312A'],
  ['sketches', '#C2C9D3', '#2B313A'],
  ['paper-projects', '#D7D0C3', '#39342C'],
];

// [name, width, height, light, dark]: 2x of a 1344px hero. The hub's is
// 16:10 (docs/design/CaseStudy.dc.html), a part's 16:9 (SubStudy.dc.html).
const HEROES = [
  ['vers1ons-hero', 2688, 1680, '#CFC9BE', '#34302A'],
  ['distribution-hero', 2688, 1512, '#C3C8CF', '#2C3037'],
];

const CRC = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});
const crc32 = (buf) => {
  let c = -1;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
};
function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const out = Buffer.alloc(body.length + 8);
  out.writeUInt32BE(data.length, 0);
  body.copy(out, 4);
  out.writeUInt32BE(crc32(body), body.length + 4);
  return out;
}

// mulberry32: the same grain on every run, so regenerating changes nothing.
function random(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 2 ** 32;
  };
}

function png(hex, seed, WIDTH, HEIGHT, GRAIN = POSTER_GRAIN, GRAIN_SIZE = POSTER_GRAIN_SIZE) {
  const rgb = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const next = random(seed);
  const across = Math.ceil(WIDTH / GRAIN_SIZE) + 1;
  const lattice = Array.from({ length: across * (Math.ceil(HEIGHT / GRAIN_SIZE) + 1) }, () => (next() * 2 - 1) * GRAIN);
  const ease = (t) => t * t * (3 - 2 * t);
  const rows = [];
  for (let y = 0; y < HEIGHT; y++) {
    const row = Buffer.alloc(1 + WIDTH * 3); // filter byte 0, then RGB
    const gy = Math.floor(y / GRAIN_SIZE);
    const ty = ease(y / GRAIN_SIZE - gy);
    for (let x = 0; x < WIDTH; x++) {
      const gx = Math.floor(x / GRAIN_SIZE);
      const tx = ease(x / GRAIN_SIZE - gx);
      const at = (dx, dy) => lattice[(gy + dy) * across + gx + dx];
      const top = at(0, 0) * (1 - tx) + at(1, 0) * tx;
      const bottom = at(0, 1) * (1 - tx) + at(1, 1) * tx;
      const g = Math.round(top * (1 - ty) + bottom * ty); // monochrome
      row.set(rgb.map((c) => Math.min(255, Math.max(0, c + g))), 1 + x * 3);
    }
    rows.push(row);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(WIDTH, 0);
  ihdr.writeUInt32BE(HEIGHT, 4);
  ihdr.set([8, 2, 0, 0, 0], 8); // 8-bit RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(Buffer.concat(rows), { level: 6 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

await mkdir(OUT, { recursive: true });
for (const [i, [slug, light, dark]] of TONES.entries()) {
  await writeFile(join(OUT, `${slug}.png`), png(light, 2 * i + 1, WIDTH, HEIGHT));
  await writeFile(join(OUT, `${slug}-dark.png`), png(dark, 2 * i + 2, WIDTH, HEIGHT));
}
for (const [i, [name, w, h, light, dark]] of HEROES.entries()) {
  await writeFile(join(OUT, `${name}.png`), png(light, 101 + 2 * i, w, h, HERO_GRAIN, HERO_GRAIN_SIZE));
  await writeFile(join(OUT, `${name}-dark.png`), png(dark, 102 + 2 * i, w, h, HERO_GRAIN, HERO_GRAIN_SIZE));
}
console.log(`Wrote ${TONES.length * 2} posters and ${HEROES.length * 2} heroes to ${OUT}`);
