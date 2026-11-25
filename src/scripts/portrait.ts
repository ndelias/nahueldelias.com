// The character portrait, shared by the homepage (about.ts) and the lab's
// homepage layouts (src/lab/home/lab.ts).

import portraitGrid from '../assets/about/portrait.json';

/* ---------- The portrait ----------
   A grid of characters made from the photo by scripts/portrait.mjs, drawn in
   the page's ink. It settles as the lines from the steps reach it: each cell
   scrambles until its moment (roughly top to bottom, with scatter), then
   lands on its own character. In the dark theme the ramp flips (dense for
   light), so it reads as the photo, not its negative. Redrawn when the
   theme changes. */
export function portrait(canvas: HTMLCanvasElement) {
  const { cols: COLS, rows: ROWS, grid } = portraitGrid as { cols: number; rows: number; grid: string[] };
  const RAMP = ' .:-=+*xzYX%#'; // as in scripts/portrait.mjs
  const light = grid.join('');
  const dark = [...light].map((c) => { const i = RAMP.indexOf(c); return i > 0 ? RAMP[RAMP.length - i] : c; }).join('');
  let cells = light;
  const NOISE = 'zyx*?=+:/|%#ZYX';
  const settle = Array.from({ length: light.length }, (_, i) => Math.min(0.98, (Math.floor(i / COLS) / ROWS) * 0.6 + Math.random() * 0.4));
  const g = canvas.getContext('2d')!;
  // The tokens are light-dark() pairs: read them resolved, from the page.
  const probe = document.createElement('span');
  probe.hidden = true;
  document.body.append(probe);
  const color = (v: string) => ((probe.style.color = `var(${v})`), getComputedStyle(probe).color);
  let ink = '', muted = '', last = -1, W = 0, H = 0;
  const size = () => {
    const dpr = Math.min(2, devicePixelRatio || 1);
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    ink = color('--ink'); muted = color('--muted');
    cells = document.documentElement.dataset.theme === 'dark' ? dark : light;
    last = -1;
  };
  const draw = (k: number) => {
    if (Math.abs(k - last) < 0.004) return;
    last = k;
    const cw = W / COLS, ch = H / ROWS;
    g.clearRect(0, 0, W, H);
    g.font = `${ch * 1.08}px ${getComputedStyle(document.documentElement).getPropertyValue('--font-mono')}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (let i = 0; i < cells.length; i++) {
      const done = k >= settle[i];
      const c = done ? cells[i] : k > settle[i] - 0.25 ? NOISE[(Math.random() * NOISE.length) | 0] : '';
      if (!c || c === ' ') continue;
      g.globalAlpha = !done ? 0.55 : c === '·' ? 0.35 : 1;
      g.fillStyle = done && c !== '·' ? ink : muted;
      g.fillText(c, ((i % COLS) + 0.5) * cw, (Math.floor(i / COLS) + 0.5) * ch);
    }
    g.globalAlpha = 1;
  };
  size();
  new MutationObserver(() => { const k = last; size(); draw(k); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  addEventListener('resize', () => { const k = last; size(); draw(k); });
  return draw;
}
