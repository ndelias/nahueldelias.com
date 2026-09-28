#!/usr/bin/env node
// Writes src/styles/fallbacks.css: a metric-matched local fallback for each
// webface, so the font-display: swap causes no reflow. The fallback is scaled
// (size-adjust) to the webface's average glyph width, and its vertical metrics
// are overridden with the webface's, so lines keep their height and wrap in
// nearly the same places.
//
// Reads the real font tables: the woff2 files in src/assets/fonts (Node's
// built-in brotli decompresses them) and the fallback TTFs, by default from
// macOS. Arimo/Liberation Sans and Cousine/Liberation Mono are metric clones of
// Arial and Courier New, so the same numbers hold where those stand in.
// Dependency-free; run it again only if a font file changes:
//
//   node scripts/font-metrics.mjs [--arial path] [--courier path]

import { readFile, writeFile } from 'node:fs/promises';
import { brotliDecompressSync } from 'node:zlib';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
};

const FALLBACKS = {
  arial: { path: arg('arial', '/System/Library/Fonts/Supplemental/Arial.ttf'), local: ['Arial', 'Arimo', 'Liberation Sans'] },
  courier: { path: arg('courier', '/System/Library/Fonts/Supplemental/Courier New.ttf'), local: ['Courier New', 'Cousine', 'Liberation Mono'] },
};

const FACES = [
  { family: 'Instrument Sans', weight: 400, file: 'instrument-sans-latin-400-normal.woff2', fallback: 'arial' },
  { family: 'Instrument Sans', weight: 500, file: 'instrument-sans-latin-500-normal.woff2', fallback: 'arial' },
  { family: 'DM Mono', weight: 400, file: 'dm-mono-latin-400-normal.woff2', fallback: 'courier' },
];

// Width is averaged over running English text, so letters count as often as
// they occur in prose rather than equally.
const SAMPLE =
  'The site has one job with three parts: survive an eight-second skim, get a cold applicant past a ' +
  'referral-favoring funnel, and supply defensible material for the conversation and paid work trial ' +
  'where hiring decisions actually get made. Every substantial item names a real decision with a cost. ' +
  'What was chosen, what was rejected, what it cost. Product engineer, 2026. Work, Studies, Data, Play.';

// --- Table readers ---------------------------------------------------------

const WOFF2_TAGS = ('cmap head hhea hmtx maxp name OS/2 post cvt  fpgm glyf loca prep CFF  VORG EBDT EBLC gasp ' +
  'hdmx kern LTSH PCLT VDMX vhea vmtx BASE GDEF GPOS GSUB EBSC JSTF MATH CBDT CBLC COLR CPAL SVG  sbix acnt avar ' +
  'bdat bloc bsln cvar fdsc feat fmtx fvar gvar hsty just lcar mort morx opbd prop trak Zapf Silf Glat Gloc Feat Sill')
  .match(/.{4} ?/g)
  .map((t) => t.slice(0, 4));

/** @returns {Map<string, Buffer>} */
function woff2Tables(buf) {
  if (buf.toString('latin1', 0, 4) !== 'wOF2') throw new Error('Not a woff2 file');
  const count = buf.readUInt16BE(12);
  let o = 48;
  const base128 = () => {
    let v = 0;
    for (let i = 0; i < 5; i++) {
      const b = buf[o++];
      v = v * 128 + (b & 127);
      if (!(b & 128)) return v;
    }
    throw new Error('Bad UIntBase128');
  };
  const dir = [];
  for (let i = 0; i < count; i++) {
    const flags = buf[o++];
    const tag = (flags & 63) === 63 ? buf.toString('latin1', o, (o += 4)) : WOFF2_TAGS[flags & 63];
    const version = flags >> 6;
    const length = base128();
    const transformed = tag === 'glyf' || tag === 'loca' ? version === 0 : version !== 0;
    dir.push({ tag, length: transformed ? base128() : length, transformed });
  }
  const data = brotliDecompressSync(buf.subarray(o, o + buf.readUInt32BE(20)));
  const tables = new Map();
  let at = 0;
  for (const t of dir) {
    // Only glyf/loca are transformed in these files; nothing here reads them.
    if (!t.transformed) tables.set(t.tag, data.subarray(at, at + t.length));
    at += t.length;
  }
  return tables;
}

/** @returns {Map<string, Buffer>} */
function sfntTables(buf) {
  const tables = new Map();
  for (let i = 0, n = buf.readUInt16BE(4); i < n; i++) {
    const r = 12 + i * 16;
    tables.set(buf.toString('latin1', r, r + 4), buf.subarray(buf.readUInt32BE(r + 8), buf.readUInt32BE(r + 8) + buf.readUInt32BE(r + 12)));
  }
  return tables;
}

/** Unicode → glyph id, from the (3,1) or (0,3) format 4 cmap subtable. */
function cmap(t) {
  for (let i = 0, n = t.readUInt16BE(2); i < n; i++) {
    const platform = t.readUInt16BE(4 + i * 8);
    const encoding = t.readUInt16BE(6 + i * 8);
    const s = t.readUInt32BE(8 + i * 8);
    if (!((platform === 3 && encoding === 1) || platform === 0) || t.readUInt16BE(s) !== 4) continue;
    const segs = t.readUInt16BE(s + 6) / 2;
    const ends = s + 14, starts = ends + segs * 2 + 2, deltas = starts + segs * 2, ranges = deltas + segs * 2;
    return (code) => {
      for (let k = 0; k < segs; k++) {
        if (code > t.readUInt16BE(ends + k * 2)) continue;
        const start = t.readUInt16BE(starts + k * 2);
        if (code < start) return 0;
        const delta = t.readInt16BE(deltas + k * 2);
        const range = t.readUInt16BE(ranges + k * 2);
        if (!range) return (code + delta) & 0xffff;
        const g = t.readUInt16BE(ranges + k * 2 + range + (code - start) * 2);
        return g ? (g + delta) & 0xffff : 0;
      }
      return 0;
    };
  }
  throw new Error('No format 4 cmap subtable');
}

function metrics(tables) {
  const head = tables.get('head'), hhea = tables.get('hhea'), os2 = tables.get('OS/2'), hmtx = tables.get('hmtx');
  const upm = head.readUInt16BE(18);
  const useTypo = (os2.readUInt16BE(62) & 0x80) !== 0;
  const hmetrics = hhea.readUInt16BE(34);
  const glyph = cmap(tables.get('cmap'));
  const advance = (ch) => {
    const g = glyph(ch.codePointAt(0));
    if (!g) throw new Error(`No glyph for "${ch}"`);
    return hmtx.readUInt16BE(Math.min(g, hmetrics - 1) * 4);
  };
  return {
    upm,
    // Chrome and Firefox take hhea on macOS and typo metrics when
    // USE_TYPO_METRICS is set; report which one this uses.
    ascent: useTypo ? os2.readInt16BE(68) : hhea.readInt16BE(4),
    descent: useTypo ? os2.readInt16BE(70) : hhea.readInt16BE(6),
    lineGap: useTypo ? os2.readInt16BE(72) : hhea.readInt16BE(8),
    source: useTypo ? 'OS/2 typo' : 'hhea',
    avgWidth: [...SAMPLE].reduce((sum, ch) => sum + advance(ch), 0) / SAMPLE.length / upm,
  };
}

// --- Output ----------------------------------------------------------------

const pct = (n) => `${(n * 100).toFixed(4).replace(/\.?0+$/, '')}%`;
const fallbackMetrics = {};
for (const [key, f] of Object.entries(FALLBACKS)) fallbackMetrics[key] = metrics(sfntTables(await readFile(f.path)));

const rules = [];
const report = [];
for (const face of FACES) {
  const m = metrics(woff2Tables(await readFile(resolve(ROOT, 'src/assets/fonts', face.file))));
  const fb = FALLBACKS[face.fallback];
  const sizeAdjust = m.avgWidth / fallbackMetrics[face.fallback].avgWidth;
  const over = (v) => pct(Math.abs(v) / m.upm / sizeAdjust);
  rules.push(
    `@font-face {\n` +
      `  font-family: "${face.family} Fallback";\n` +
      `  font-style: normal;\n` +
      `  font-weight: ${face.weight};\n` +
      `  src: ${fb.local.map((n) => `local("${n}")`).join(', ')};\n` +
      `  size-adjust: ${pct(sizeAdjust)};\n` +
      `  ascent-override: ${over(m.ascent)};\n` +
      `  descent-override: ${over(m.descent)};\n` +
      `  line-gap-override: ${over(m.lineGap)};\n` +
      `}`,
  );
  report.push(`${face.family} ${face.weight}: ${m.source} ${m.ascent}/${m.descent}/${m.lineGap} @ ${m.upm}, size-adjust ${pct(sizeAdjust)}`);
}

const css = `/*
 * Generated by scripts/font-metrics.mjs. Do not edit by hand.
 *
 * Metric-matched fallbacks: local Arial / Courier New (or their metric
 * clones), scaled and given the webface's vertical metrics, so text keeps its
 * line height and nearly the same line breaks when the webfont swaps in.
 */

${rules.join('\n\n')}
`;
await writeFile(resolve(ROOT, 'src/styles/fallbacks.css'), css);
console.log(report.join('\n'));
