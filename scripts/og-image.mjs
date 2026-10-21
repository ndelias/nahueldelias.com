#!/usr/bin/env node
// The link preview image (og:image): the About page's portrait, drawn in
// characters as on the page, with the name and role under it. Run after the
// portrait or the name changes; the PNG is committed.
//
//   node scripts/og-image.mjs   (out: public/og.png)
//
// 1200×630 is the shape every preview uses; it's drawn at 2x so the
// characters stay sharp where a preview shows it large. Drawn in Chrome with
// the site's own fonts (scripts/lib/browser.mjs), so it matches the page.

import { readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import { launch } from './lib/browser.mjs';

const OUT = 'public/og.png';
const W = 1200;
const H = 630;

const font = async (file) => `data:font/woff2;base64,${(await readFile(`src/assets/fonts/${file}`)).toString('base64')}`;
const { cols, rows, grid } = JSON.parse(await readFile('src/assets/about/portrait.json', 'utf8'));

const html = `<!doctype html>
<html><head><meta charset="utf-8"><style>
  @font-face { font-family: "Instrument Sans"; font-weight: 500; src: url(${await font('instrument-sans-latin-500-normal.woff2')}); }
  @font-face { font-family: "Instrument Sans"; font-weight: 400; src: url(${await font('instrument-sans-latin-400-normal.woff2')}); }
  @font-face { font-family: "DM Mono"; src: url(${await font('dm-mono-latin-400-normal.woff2')}); }
  html, body { margin: 0; width: ${W}px; height: ${H}px; background: #F2F1ED; color: #1B1A18; overflow: hidden; }
  body { display: flex; flex-direction: column; align-items: center; justify-content: center; font-family: "Instrument Sans", sans-serif; }
  canvas { display: block; width: 375px; height: 450px; }
  h1 { margin: 22px 0 6px; font-size: 40px; font-weight: 500; letter-spacing: -0.01em; line-height: 1.1; }
  p { margin: 0; color: #67645E; font-size: 22px; line-height: 1.3; }
</style></head><body>
  <canvas></canvas>
  <h1>Nahuel D'Elias</h1>
  <p>Product engineer</p>
</body></html>`;

const browser = await launch();
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
await page.setContent(html);
await page.evaluate(async ({ cols, rows, cells }) => {
  await document.fonts.load('10px "DM Mono"');
  await document.fonts.ready;
  // As src/scripts/about.ts draws it, settled.
  const canvas = document.querySelector('canvas');
  const w = canvas.clientWidth, h = canvas.clientHeight;
  canvas.width = w * 2; canvas.height = h * 2;
  const g = canvas.getContext('2d');
  g.scale(2, 2);
  const cw = w / cols, ch = h / rows;
  g.font = `${ch * 1.08}px "DM Mono", monospace`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i];
    if (c === ' ') continue;
    g.globalAlpha = c === '·' ? 0.35 : 1;
    g.fillStyle = c === '·' ? '#67645E' : '#1B1A18';
    g.fillText(c, ((i % cols) + 0.5) * cw, (Math.floor(i / cols) + 0.5) * ch);
  }
}, { cols, rows, cells: [...grid.join('')] });
const shot = await page.screenshot({ type: 'png' });
await browser.close();

// Palette PNG: the image is a few greys, so 64 colours lose nothing visible
// and keep the file small (previews refuse or skip large images).
await writeFile(OUT, await sharp(shot).png({ palette: true, colours: 64, compressionLevel: 9 }).toBuffer());
console.log(`${OUT}: ${W * 2}×${H * 2}`);
