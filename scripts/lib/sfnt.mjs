// Font table readers shared by scripts/font-metrics.mjs and
// tests/dist/glyphs.test.mjs. Dependency-free: Node's built-in brotli
// decompresses woff2.

import { brotliDecompressSync } from 'node:zlib';

const WOFF2_TAGS = ('cmap head hhea hmtx maxp name OS/2 post cvt  fpgm glyf loca prep CFF  VORG EBDT EBLC gasp ' +
  'hdmx kern LTSH PCLT VDMX vhea vmtx BASE GDEF GPOS GSUB EBSC JSTF MATH CBDT CBLC COLR CPAL SVG  sbix acnt avar ' +
  'bdat bloc bsln cvar fdsc feat fmtx fvar gvar hsty just lcar mort morx opbd prop trak Zapf Silf Glat Gloc Feat Sill')
  .match(/.{4} ?/g)
  .map((t) => t.slice(0, 4));

/** @returns {Map<string, Buffer>} */
export function woff2Tables(buf) {
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
export function sfntTables(buf) {
  const tables = new Map();
  for (let i = 0, n = buf.readUInt16BE(4); i < n; i++) {
    const r = 12 + i * 16;
    tables.set(buf.toString('latin1', r, r + 4), buf.subarray(buf.readUInt32BE(r + 8), buf.readUInt32BE(r + 8) + buf.readUInt32BE(r + 12)));
  }
  return tables;
}

/** Unicode → glyph id, from the (3,1) or (0,3) format 4 cmap subtable. */
export function cmap(t) {
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
