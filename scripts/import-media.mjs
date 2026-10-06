#!/usr/bin/env node
// Bring picked media from an archive outside the repo into the site, ready
// to commit. One manifest per page (media/<hub>/<part>.json) lists every
// pick: where it comes from in the archive and where it goes.
//
//   node scripts/import-media.mjs media/vers1ons/distribution.json [--check]
//
// Images → src/assets/…, as high-quality WebP no wider than `width` (Astro
//   makes the AVIF and WebP sizes the pages use from these). The capture
//   rig's demo cursor, a flat light disc with a dark halo, is found and
//   removed unless the pick says "retouch": false: patched from a frame of
//   the pick's "donor" recording where that spot is clean, or else painted
//   out from its surroundings. Every retouch is listed, and a before/after
//   crop of each goes to .media-review/ to look at.
// Videos → public/media/…, re-encoded with ffmpeg: H.264, no audio track,
//   fast start, trimmed with start/duration, under the budget in the
//   manifest entry (or the defaults below).
//
// The archive is never copied wholesale: only listed files, only image and
// video types, and nothing that looks like a dotfile, key or secret. Needs
// ffmpeg on PATH for videos (a local tool, not a site dependency; CI never
// runs this, the outputs are committed). Uses sharp, which Astro already
// installs for its image service.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, extname, join, resolve } from 'node:path';
import sharp from 'sharp';

const ROOT = resolve(import.meta.dirname, '..');
const REVIEW = join(ROOT, '.media-review');
const IMAGE_TYPES = new Set(['.png', '.jpg', '.jpeg', '.webp']);
const VIDEO_TYPES = new Set(['.mp4', '.mov', '.webm']);
const REFUSE = /(^\.)|whsec|secret|token|credential|\.env|\.pem$|\.key$|id_rsa/i;
const VIDEO_BUDGET = { hero: 8_000_000, inline: 2_000_000 }; // bytes
const kb = (n) => `${(n / 1000).toFixed(0)} KB`;

const [manifestPath, ...flags] = process.argv.slice(2);
if (!manifestPath) {
  console.error('Usage: node scripts/import-media.mjs <manifest.json> [--check]');
  process.exit(2);
}
const check = flags.includes('--check');
const manifest = JSON.parse(readFileSync(resolve(manifestPath), 'utf8'));
const archive = resolve((process.env.MEDIA_ARCHIVE ?? manifest.archive).replace(/^~(?=\/)/, homedir()));

function source(rel) {
  const file = resolve(archive, rel);
  if (!file.startsWith(archive + '/')) throw new Error(`${rel}: outside the archive`);
  if (rel.split('/').some((part) => REFUSE.test(part))) throw new Error(`${rel}: refused (looks like a dotfile or a secret)`);
  if (!existsSync(file)) throw new Error(`${rel}: not found in ${archive}`);
  return file;
}

// --- the demo cursor --------------------------------------------------------

const lum = (d, i) => (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000;

/** Cursors in a raw RGB(A) image: [{ x, y, r }]. A filled light disc
    (radius ~15–30px at 2x) with dark pixels all the way round it. Text,
    icons and buttons never fill a disc like that. */
function findCursors(d, W, H, C) {
  const bright = new Uint8Array(W * H);
  for (let p = 0, i = 0; p < W * H; p++, i += C) {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    bright[p] = lum(d, i) > 205 && Math.abs(r - g) < 14 && Math.abs(g - b) < 14 ? 1 : 0;
  }
  // Integral image of the bright mask, for box counts.
  const I = new Uint32Array((W + 1) * (H + 1));
  for (let y = 1; y <= H; y++) {
    let row = 0;
    for (let x = 1; x <= W; x++) {
      row += bright[(y - 1) * W + (x - 1)];
      I[y * (W + 1) + x] = I[(y - 1) * (W + 1) + x] + row;
    }
  }
  const box = (x0, y0, x1, y1) => I[y1 * (W + 1) + x1] - I[y0 * (W + 1) + x1] - I[y1 * (W + 1) + x0] + I[y0 * (W + 1) + x0];
  const found = [];
  const half = 10; // a 20×20 square sits inside any disc of radius ≥ 15
  for (let y = 40; y < H - 40; y += 3) {
    for (let x = 40; x < W - 40; x += 3) {
      if (box(x - half, y - half, x + half, y + half) < 0.98 * (2 * half) ** 2) continue;
      if (found.some((f) => Math.hypot(f.x - x, f.y - y) < 60)) continue;
      // Radius: walk out until it stops being bright, in 8 directions.
      const radii = [];
      for (let k = 0; k < 8; k++) {
        const a = (k * Math.PI) / 4;
        let r = 0;
        while (r < 40 && bright[Math.round(y + r * Math.sin(a)) * W + Math.round(x + r * Math.cos(a))]) r++;
        radii.push(r);
      }
      const rMin = Math.min(...radii), rMax = Math.max(...radii);
      if (rMin < 12 || rMax > 34 || rMax - rMin > 8) continue; // not a round disc
      // Recentre on the disc, then require a dark ring just outside it.
      const cx = Math.round(x + (radii[0] - radii[4]) / 2);
      const cy = Math.round(y + (radii[2] - radii[6]) / 2);
      const r = Math.round((rMin + rMax) / 2);
      let dark = 0;
      for (let k = 0; k < 48; k++) {
        const a = (k * Math.PI) / 24;
        const px = Math.round(cx + (r + 4) * Math.cos(a)), py = Math.round(cy + (r + 4) * Math.sin(a));
        if (lum(d, (py * W + px) * C) < 90) dark++;
      }
      if (dark < 40) continue;
      // The cursor is light all the way through (it's slightly see-through,
      // so light text under it shows faintly). A checkbox or badge has a dark
      // mark inside it: reject any disc with a dark pixel in it.
      let lo = 255, hi = 0;
      for (let yy = cy - r + 4; yy <= cy + r - 4; yy++) {
        for (let xx = cx - r + 4; xx <= cx + r - 4; xx++) {
          if ((xx - cx) ** 2 + (yy - cy) ** 2 > (r - 4) ** 2) continue;
          const l = lum(d, (yy * W + xx) * C);
          lo = Math.min(lo, l);
          hi = Math.max(hi, l);
        }
      }
      if (lo >= 170) found.push({ x: cx, y: cy, r });
    }
  }
  return found;
}

/** Paint a cursor out: every pixel in the disc and its halo is interpolated
    from just outside it, along whichever axis has the closer pair of edge
    colors there (so a border running under the dot carries through). */
function paintOut(d, W, H, C, { x: cx, y: cy, r }, pad = 24) {
  const R = r + pad; // the disc and its soft drop shadow
  const src = Buffer.from(d);
  const at = (x, y) => (Math.min(H - 1, Math.max(0, y)) * W + Math.min(W - 1, Math.max(0, x))) * C;
  const diff = (i, j) => Math.abs(src[i] - src[j]) + Math.abs(src[i + 1] - src[j + 1]) + Math.abs(src[i + 2] - src[j + 2]);
  for (let dy = -R; dy <= R; dy++) {
    const span = Math.floor(Math.sqrt(R * R - dy * dy));
    for (let dx = -span; dx <= span; dx++) {
      const x = cx + dx, y = cy + dy;
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const vspan = Math.floor(Math.sqrt(R * R - dx * dx));
      const L = at(cx - span - 1, y), Rt = at(cx + span + 1, y);
      const T = at(x, cy - vspan - 1), B = at(x, cy + vspan + 1);
      const horizontal = diff(L, Rt) <= diff(T, B);
      const [a, b, t] = horizontal ? [L, Rt, (dx + span + 1) / (2 * span + 2)] : [T, B, (dy + vspan + 1) / (2 * vspan + 2)];
      const o = at(x, y);
      for (let c = 0; c < 3; c++) d[o + c] = Math.round(src[a + c] * (1 - t) + src[b + c] * t);
    }
  }
}

// --- patching from a recording ---------------------------------------------
//
// Stills cut from a walkthrough recording show the same screen in other
// frames, with the cursor somewhere else. A pick with "donor": <video>
// patches each cursor from the closest-matching frame where that spot is
// clean, so text and controls under the dot come back for real. Painting
// out by interpolation is the fallback.

const SMALL = 480;
const donors = new Map(); // video → { frames: [{ t, data }], h, fps }

function grayAt(buf, w, x, y) {
  return buf[y * w + x];
}

async function donorFrames(video) {
  if (donors.has(video)) return donors.get(video);
  const fps = 4;
  const raw = execFileSync('ffmpeg', ['-v', 'error', '-i', video, '-vf', `fps=${fps},scale=${SMALL}:-2,format=gray`, '-f', 'rawvideo', '-'], { maxBuffer: 1 << 30 });
  const probe = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', video], { encoding: 'utf8' }).trim().split(',').map(Number);
  const h = Math.round((probe[1] * SMALL) / probe[0] / 2) * 2;
  const size = SMALL * h;
  const frames = [];
  for (let i = 0; i * size < raw.length; i++) frames.push({ t: i / fps, data: raw.subarray(i * size, (i + 1) * size) });
  const entry = { frames, h, fullW: probe[0], fullH: probe[1] };
  donors.set(video, entry);
  return entry;
}

/** Patch one cursor from the recording. Returns true when it did. The
    patch is the disc and its halo, or the whole `rect` it sits in (a button
    under the cursor is in its hover state; a clean frame shows it at rest,
    so the whole button comes from there). */
async function patchFromDonor(d, W, H, C, cursor, video, rect, at, force = false) {
  const don = await donorFrames(video);
  if (don.fullW !== W || don.fullH !== H) return false;
  const small = await sharp(d, { raw: { width: W, height: H, channels: C } }).resize(SMALL, don.h).grayscale().raw().toBuffer();
  const s = SMALL / W;
  const R = cursor.r + 24; // the disc and its soft drop shadow
  const area = rect
    ? { x0: rect[0], y0: rect[1], x1: rect[0] + rect[2], y1: rect[1] + rect[3] }
    : { x0: cursor.x - R, y0: cursor.y - R, x1: cursor.x + R, y1: cursor.y + R };
  const inside = (x, y) =>
    rect ? x >= area.x0 && x < area.x1 && y >= area.y0 && y < area.y1 : Math.hypot(x - cursor.x, y - cursor.y) <= R;
  // Rank frames by how well the screen matches outside the patch: first
  // the whole screen (same screen at all?), then the band around the patch.
  const band = 40 * s;
  const scored = don.frames.map((f) => {
    let g = 0, gn = 0, l = 0, ln = 0;
    for (let y = 0; y < don.h; y += 2) {
      for (let x = 0; x < SMALL; x += 2) {
        if (inside(x / s, y / s)) continue;
        const v = Math.abs(grayAt(small, SMALL, x, y) - grayAt(f.data, SMALL, x, y));
        g += v; gn++;
        if (x >= area.x0 * s - band && x <= area.x1 * s + band && y >= area.y0 * s - band && y <= area.y1 * s + band) { l += v; ln++; }
      }
    }
    return { t: f.t, screen: g / gn, local: ln ? l / ln : 0 };
  });
  // Same screen only: within a hair of the best whole-screen match.
  const best = Math.min(...scored.map((f) => f.screen));
  const same = scored.filter((f) => f.screen <= Math.min(6, best + 1.5));
  // A rectangle can name its moment (picked by eye: the same control, at
  // rest); then that frame is the only candidate, still seam-checked.
  const ranked = at != null ? [{ t: at }] : same.sort((a, b) => a.local - b.local).slice(0, 60);
  const why = { screen: scored.length - same.length, cursor: 0, seam: 0, content: 0 };
  for (const cand of ranked) {
    const full = execFileSync('ffmpeg', ['-v', 'error', '-ss', String(cand.t), '-i', video, '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: 1 << 28 });
    // The donor's own cursor must be well clear of the patch.
    const clear = (c) =>
      c.x + c.r + 12 < area.x0 || c.x - c.r - 12 > area.x1 || c.y + c.r + 12 < area.y0 || c.y - c.r - 12 > area.y1;
    if (!findCursors(full, W, H, 3).every(clear)) { why.cursor++; continue; }
    // The pixels just outside the patch must match, or the seam shows.
    let diff = 0, n = 0;
    const edge = (x, y) => {
      if (x < 0 || y < 0 || x >= W || y >= H || inside(x, y)) return;
      const i = (y * W + x) * C, j = (y * W + x) * 3;
      diff += Math.abs(d[i] - full[j]) + Math.abs(d[i + 1] - full[j + 1]) + Math.abs(d[i + 2] - full[j + 2]);
      n++;
    };
    if (rect) {
      for (let x = area.x0 - 4; x <= area.x1 + 4; x += 2) { edge(x, area.y0 - 4); edge(x, area.y1 + 3); }
      for (let y = area.y0 - 4; y <= area.y1 + 4; y += 2) { edge(area.x0 - 4, y); edge(area.x1 + 3, y); }
    } else {
      for (let k = 0; k < 96; k++) {
        const a = (k * Math.PI) / 48;
        for (const rr of [R + 3, R + 8]) edge(Math.round(cursor.x + rr * Math.cos(a)), Math.round(cursor.y + rr * Math.sin(a)));
      }
    }
    if (!force && (!n || diff / n > 18)) { why.seam++; cursor.seam = Math.min(cursor.seam ?? 1e9, n ? diff / n : 1e9); continue; }
    // A frame where the cursor is fading in or out leaves its shadow: no
    // pixel in a round patch may be much darker than the darkest around it.
    if (!rect) {
      let ringMin = 255;
      for (let k = 0; k < 96; k++) {
        const a = (k * Math.PI) / 48;
        const x = Math.round(cursor.x + (R + 4) * Math.cos(a)), y = Math.round(cursor.y + (R + 4) * Math.sin(a));
        if (x >= 0 && y >= 0 && x < W && y < H) ringMin = Math.min(ringMin, lum(d, (y * W + x) * C));
      }
      let shadow = 0, total = 0;
      for (let y = cursor.y - R; y <= cursor.y + R; y += 2) {
        for (let x = cursor.x - R; x <= cursor.x + R; x += 2) {
          if (x < 0 || y < 0 || x >= W || y >= H || Math.hypot(x - cursor.x, y - cursor.y) > R) continue;
          total++;
          if (lum(full, (y * W + x) * 3) < ringMin - 6) shadow++;
        }
      }
      if (shadow > total * 0.01) { why.seam++; continue; }
    }
    // Inside a rectangle, away from the cursor and its glow, the donor must
    // show the same thing: a hover glow is a small difference, a missing or
    // disabled button is a big one.
    if (rect && at == null) {
      let inDiff = 0, inN = 0;
      for (let y = area.y0; y < area.y1; y += 2) {
        for (let x = area.x0; x < area.x1; x += 2) {
          if (x >= W || y >= H || Math.hypot(x - cursor.x, y - cursor.y) <= R + 14) continue;
          const i = (y * W + x) * C, j = (y * W + x) * 3;
          inDiff += Math.abs(lum(d, i) - lum(full, j));
          inN++;
        }
      }
      if (inN && inDiff / inN > 12) { why.content++; continue; }
    }
    // Video frames come out a few levels off the PNG stills (YUV round
    // trip): measure the per-channel offset along the seam and apply it,
    // then copy, feathering the last 12 pixels into the still.
    const off = [0, 0, 0];
    let on = 0;
    const sample = (x, y) => {
      if (x < 0 || y < 0 || x >= W || y >= H || inside(x, y)) return;
      const i = (y * W + x) * C, j = (y * W + x) * 3;
      for (let c = 0; c < 3; c++) off[c] += d[i + c] - full[j + c];
      on++;
    };
    for (let x = area.x0 - 14; x <= area.x1 + 14; x += 2) { sample(x, area.y0 - 14); sample(x, area.y1 + 13); }
    for (let y = area.y0 - 14; y <= area.y1 + 14; y += 2) { sample(area.x0 - 14, y); sample(area.x1 + 13, y); }
    for (let c = 0; c < 3; c++) off[c] = on ? off[c] / on : 0;
    const F = 12;
    for (let y = area.y0 - F; y < area.y1 + F; y++) {
      for (let x = area.x0 - F; x < area.x1 + F; x++) {
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        const out = rect
          ? Math.max(area.x0 - x, x - (area.x1 - 1), area.y0 - y, y - (area.y1 - 1), 0)
          : Math.max(0, Math.hypot(x - cursor.x, y - cursor.y) - R);
        const w = out >= F ? 0 : 1 - out / F;
        if (!w) continue;
        const i = (y * W + x) * C, j = (y * W + x) * 3;
        for (let c = 0; c < 3; c++) d[i + c] = Math.round(d[i + c] * (1 - w) + Math.min(255, Math.max(0, full[j + c] + off[c])) * w);
      }
    }
    cursor.patched = cand.t;
    return true;
  }
  cursor.why = why;
  return false;
}

// --- cloning from the same image ---------------------------------------------
//
// When no frame has the spot clean, the same widget often appears elsewhere in
// the same image (the checkbox in the row above, the same word in another
// line). A patch { rect, clone: [x0, y0, x1, y1] } searches that window for
// the offset whose pixels best match the rectangle outside the cursor, and
// copies from there.

function clonePatch(d, W, H, C, cursor, rect, win) {
  const R = cursor.r + 24;
  const [rx, ry, rw, rh] = rect;
  const L = new Float32Array(W * H);
  for (let p = 0; p < W * H; p++) L[p] = lum(d, p * C);
  const pts = [];
  for (let y = ry; y < ry + rh; y++) for (let x = rx; x < rx + rw; x++) if (Math.hypot(x - cursor.x, y - cursor.y) > R) pts.push([x, y]);
  const cost = (dx, dy, step) => {
    let c = 0;
    for (let i = 0; i < pts.length; i += step) {
      const [x, y] = pts[i];
      c += Math.abs(L[y * W + x] - L[(y + dy) * W + (x + dx)]);
    }
    return c / Math.ceil(pts.length / step);
  };
  let best = { c: Infinity };
  const [x0, y0, x1, y1] = win;
  for (let sy = y0; sy + rh <= y1; sy += 3) {
    for (let sx = x0; sx + rw <= x1; sx += 3) {
      const dx = sx - rx, dy = sy - ry;
      if (Math.abs(dx) < rw && Math.abs(dy) < rh) continue; // not the spot itself
      const c = cost(dx, dy, 7);
      if (c < best.c) best = { c, dx, dy };
    }
  }
  if (!Number.isFinite(best.c)) return false;
  for (let ddy = -3; ddy <= 3; ddy++) {
    for (let ddx = -3; ddx <= 3; ddx++) {
      const c = cost(best.dx + ddx, best.dy + ddy, 1);
      if (c < (best.fine ?? Infinity)) Object.assign(best, { fine: c, fdx: best.dx + ddx, fdy: best.dy + ddy });
    }
  }
  if (best.fine > 10) return false; // nothing alike enough
  const src = Buffer.from(d);
  const F = 4;
  for (let y = ry - F; y < ry + rh + F; y++) {
    for (let x = rx - F; x < rx + rw + F; x++) {
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const out = Math.max(rx - x, x - (rx + rw - 1), ry - y, y - (ry + rh - 1), 0);
      const w = out >= F ? 0 : 1 - out / F;
      if (!w) continue;
      const i = (y * W + x) * C, j = ((y + best.fdy) * W + (x + best.fdx)) * C;
      for (let c = 0; c < 3; c++) d[i + c] = Math.round(src[i + c] * (1 - w) + src[j + c] * w);
    }
  }
  cursor.cloned = [best.fdx, best.fdy, best.fine];
  return true;
}

// --- images -----------------------------------------------------------------

async function importImage(pick) {
  const from = source(pick.from);
  if (!IMAGE_TYPES.has(extname(from).toLowerCase())) throw new Error(`${pick.from}: not an image`);
  const to = join(ROOT, 'src/assets', pick.to);
  let img = sharp(from).removeAlpha();
  if (pick.crop) img = img.extract({ left: pick.crop[0], top: pick.crop[1], width: pick.crop[2], height: pick.crop[3] });
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: C } = info;
  const cursors = pick.retouch === false ? [] : findCursors(data, W, H, C);
  for (const c of cursors) {
    if (!check) {
      mkdirSync(REVIEW, { recursive: true });
      const crop = (buf) =>
        sharp(buf, { raw: { width: W, height: H, channels: C } })
          .extract({ left: Math.max(0, c.x - 90), top: Math.max(0, c.y - 90), width: Math.min(180, W - Math.max(0, c.x - 90)), height: Math.min(180, H - Math.max(0, c.y - 90)) })
          .resize(360);
      const name = `${basename(pick.to, extname(pick.to))}-${c.x}x${c.y}`;
      await crop(Buffer.from(data)).png().toFile(join(REVIEW, `${name}-before.png`));
      // A patch rectangle from the manifest that this cursor sits in, if any.
      // A patch rectangle from the manifest that this cursor sits in, if any:
      // [x, y, w, h] or { rect: [x, y, w, h], at: seconds }.
      const patch = (pick.patch ?? []).map((p) => (Array.isArray(p) ? { rect: p } : p)).find(({ rect: [x, y, w, h] }) => c.x >= x && c.x < x + w && c.y >= y && c.y < y + h);
      // "method": "paint" skips the recording (a flat spot, or a recording
      // whose frames all carry the cursor's shadow there); "pad" shrinks the
      // painted area when text sits just outside the dot.
      const done =
        pick.method !== 'paint' &&
        (patch?.clone
          ? clonePatch(data, W, H, C, c, patch.rect, patch.clone)
          : pick.donor && (await patchFromDonor(data, W, H, C, c, source(pick.donor), patch?.rect, patch?.at, patch?.force && patch?.at != null)));
      if (!done) paintOut(data, W, H, C, c, pick.pad);
      await crop(data).png().toFile(join(REVIEW, `${name}-after.png`));
    }
  }
  // Restores: after the cursor is gone, copy a small box back from an exact
  // twin elsewhere in the same image (a letter's tail the cursor covered,
  // from the same word in another line). { rect: [x, y, w, h], from: [dx, dy] }
  if (!check && pick.restore) {
    const src = Buffer.from(data);
    for (const { rect: [rx, ry, rw, rh], from: [dx, dy] } of pick.restore) {
      for (let y = ry; y < ry + rh; y++) {
        for (let x = rx; x < rx + rw; x++) {
          const i = (y * W + x) * C, j = ((y + dy) * W + (x + dx)) * C;
          for (let c = 0; c < 3; c++) data[i + c] = src[j + c];
        }
      }
    }
  }
  if (check) return { to: pick.to, cursors };
  // Art: an image the capture caught mid-load (the cover art drawing in from
  // the top) gets the finished file the screen was loading, in the same box.
  // { from: archive file, rect: [x, y, w, h], radius }. Line the rect up
  // with the part that had loaded.
  let out = sharp(data, { raw: { width: W, height: H, channels: C } });
  if (pick.art) {
    const { rect: [ax, ay, aw, ah], radius = 0 } = pick.art;
    const mask = Buffer.from(`<svg width="${aw}" height="${ah}"><rect width="${aw}" height="${ah}" rx="${radius}" fill="#fff"/></svg>`);
    const art = await sharp(source(pick.art.from)).resize(aw, ah).ensureAlpha().composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
    out = sharp(await out.composite([{ input: art, left: ax, top: ay }]).png().toBuffer());
  }
  mkdirSync(dirname(to), { recursive: true });
  await out
    .resize({ width: pick.width ?? 2560, withoutEnlargement: true })
    .webp({ quality: pick.quality ?? 90, effort: 6 })
    .toFile(to);
  return { to: pick.to, cursors, bytes: statSync(to).size };
}

// --- videos -----------------------------------------------------------------

function importVideo(pick) {
  const from = source(pick.from);
  if (!VIDEO_TYPES.has(extname(from).toLowerCase())) throw new Error(`${pick.from}: not a video`);
  const to = join(ROOT, 'public', pick.to);
  const budget = pick.budget ?? VIDEO_BUDGET[pick.kind ?? 'inline'];
  if (check) return { to: pick.to };
  mkdirSync(dirname(to), { recursive: true });
  // Hold: a box that's still loading early in the clip shows how it looks
  // once loaded, taken from a later moment of the same recording, until the
  // recording gets there itself. { rect: [x, y, w, h], at: seconds }; the
  // box must not move in between.
  const scale = `scale=${pick.width ?? 1344}:-2:flags=lanczos,format=yuv420p`;
  const hold = pick.hold
    ? ['-ss', String(pick.hold.at), '-i', from, '-filter_complex',
       `[1:v]trim=end_frame=1,crop=${pick.hold.rect[2]}:${pick.hold.rect[3]}:${pick.hold.rect[0]}:${pick.hold.rect[1]},loop=-1:1,setpts=N/FRAME_RATE/TB[h];` +
       `[0:v][h]overlay=${pick.hold.rect[0]}:${pick.hold.rect[1]}:shortest=1:enable='lt(t,${pick.hold.at - (pick.start ?? 0)})',${scale}`]
    : ['-vf', scale];
  const encode = (crf) =>
    execFileSync('ffmpeg', [
      '-v', 'error', '-y',
      ...(pick.start != null ? ['-ss', String(pick.start)] : []),
      ...(pick.duration != null ? ['-t', String(pick.duration)] : []),
      '-i', from,
      '-an',
      ...hold,
      '-c:v', 'libx264', '-preset', 'slow', '-crf', String(crf), '-profile:v', 'high',
      '-movflags', '+faststart',
      to,
    ]);
  // Start at the manifest's quality and step down until it fits.
  let crf = pick.crf ?? 24;
  encode(crf);
  while (statSync(to).size > budget && crf < 34) encode((crf += 2));
  const bytes = statSync(to).size;
  if (bytes > budget) throw new Error(`${pick.to}: ${kb(bytes)} is over its ${kb(budget)} budget even at crf ${crf}`);
  return { to: pick.to, bytes, crf };
}

// --- run --------------------------------------------------------------------

const lines = [];
let retouched = 0;
for (const pick of manifest.images ?? []) {
  const r = await importImage(pick);
  retouched += r.cursors.length;
  const how = (c) =>
    c.cloned
      ? `cloned from ${c.cloned[0]},${c.cloned[1]} away in the same image (match ${c.cloned[2].toFixed(1)})`
      : c.patched != null
      ? `patched from the recording at ${c.patched.toFixed(2)}s`
      : `painted out${c.why ? `; no clean frame: ${c.why.cursor} had the cursor there, ${c.why.seam} didn't match at the edge${c.seam ? ` (best ${c.seam.toFixed(0)})` : ''}, ${c.why.content} showed something else` : ''}`;
  lines.push(`image  ${r.bytes ? kb(r.bytes).padStart(7) : '       '}  ${r.to}${r.cursors.map((c) => `  (cursor at ${c.x},${c.y} ${check ? 'found' : how(c)})`).join('')}`);
}
for (const pick of manifest.videos ?? []) {
  const r = importVideo(pick);
  lines.push(`video  ${r.bytes ? kb(r.bytes).padStart(7) : '       '}  ${r.to}${r.crf ? `  (crf ${r.crf})` : ''}`);
}
console.log(lines.join('\n'));
console.log(`${check ? 'Checked' : 'Imported'} ${manifest.images?.length ?? 0} images, ${manifest.videos?.length ?? 0} videos; ${retouched} cursor${retouched === 1 ? '' : 's'} ${check ? 'found' : 'removed (before/after crops in .media-review/)'}.`);
