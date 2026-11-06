// M08, scramble and settle: the About page's portrait (src/scripts/about.ts,
// portrait()), drawn the same way. A grid of characters made from the photo
// (scripts/portrait.mjs). Each cell has a moment, roughly top to bottom with
// scatter; until a quarter before it, the cell is empty, then it flickers
// through noise characters, then lands on its own. In the dark theme the
// ramp flips (dense for light), so it reads as the photo, not its negative.
// On About it settles as the lines from the steps reach it; here it plays
// over 2.6s each time it comes into view (so it isn't over before anyone
// sees it), and again on the button. The pointer stirs it: cells near it
// scramble again, most at the center, and settle back as it moves on.
// Reduced motion: it's simply there, and the pointer leaves it alone.

import portraitGrid from '../../assets/about/portrait.json';
import { define } from '../runtime';
import { loop } from '../spring';

const PLAY_S = 2.6;
/** How far the pointer stirs, in cells, and how long a stirred cell takes to settle. */
const STIR_CELLS = 7;
const SETTLE_S = 0.7;

define('scramble', (stage, { reduce }) => {
  const canvas = stage.querySelector<HTMLCanvasElement>('[data-portrait]')!;
  const again = stage.querySelector<HTMLButtonElement>('[data-again]')!;
  const { cols: COLS, rows: ROWS, grid } = portraitGrid as { cols: number; rows: number; grid: string[] };
  const RAMP = ' .:-=+*xzYX%#';
  const light = grid.join('');
  const dark = [...light]
    .map((c) => {
      const i = RAMP.indexOf(c);
      return i > 0 ? RAMP[RAMP.length - i] : c;
    })
    .join('');
  const NOISE = 'zyx*?=+:/|%#ZYX';
  const settle = Array.from({ length: light.length }, (_, i) => Math.min(0.98, (Math.floor(i / COLS) / ROWS) * 0.6 + Math.random() * 0.4));
  const g = canvas.getContext('2d')!;
  const probe = document.createElement('span');
  probe.hidden = true;
  stage.append(probe);
  const color = (v: string) => ((probe.style.color = `var(${v})`), getComputedStyle(probe).color);
  let cells = light;
  let ink = '';
  let muted = '';
  let W = 0;
  let H = 0;
  let k = reduce ? 1 : 0;
  // How stirred each cell is, 1 to 0; a stirred cell shows noise that often.
  const heat = new Float32Array(light.length);
  let hot = false;
  // Played through and then out of view: it plays again on the way back.
  let replay = false;

  const size = () => {
    const dpr = Math.min(2, devicePixelRatio || 1);
    W = canvas.clientWidth;
    H = canvas.clientHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    ink = color('--ink');
    muted = color('--muted');
    cells = document.documentElement.dataset.theme === 'dark' ? dark : light;
  };
  const draw = () => {
    const cw = W / COLS;
    const ch = H / ROWS;
    g.clearRect(0, 0, W, H);
    g.font = `${ch * 1.08}px ${getComputedStyle(document.documentElement).getPropertyValue('--font-mono')}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (let i = 0; i < cells.length; i++) {
      const done = k >= settle[i] && !(heat[i] > 0 && Math.random() < heat[i]);
      const c = done ? cells[i] : k > settle[i] - 0.25 || heat[i] > 0 ? NOISE[(Math.random() * NOISE.length) | 0] : '';
      if (!c || c === ' ') continue;
      g.globalAlpha = done ? 1 : 0.55;
      g.fillStyle = done ? ink : muted;
      g.fillText(c, ((i % COLS) + 0.5) * cw, (Math.floor(i / COLS) + 0.5) * ch);
    }
    g.globalAlpha = 1;
  };

  let running = false;
  const anim = loop((dt) => {
    k = Math.min(1, k + dt / PLAY_S);
    hot = false;
    for (let i = 0; i < heat.length; i++) {
      if (heat[i] <= 0) continue;
      heat[i] = Math.max(0, heat[i] - dt / SETTLE_S);
      hot ||= heat[i] > 0;
    }
    draw();
    return running && (k < 1 || hot);
  });
  const play = () => {
    if (reduce) return;
    if (replay) {
      replay = false;
      k = 0;
    }
    running = true;
    if (k < 1 || hot) anim.start();
  };
  canvas.addEventListener('pointermove', (e) => {
    if (reduce || !running) return;
    const r = canvas.getBoundingClientRect();
    const cx = ((e.clientX - r.left) / r.width) * COLS;
    const cy = ((e.clientY - r.top) / r.height) * ROWS;
    for (let y = Math.max(0, Math.floor(cy - STIR_CELLS)); y < Math.min(ROWS, cy + STIR_CELLS); y++) {
      for (let x = Math.max(0, Math.floor(cx - STIR_CELLS)); x < Math.min(COLS, cx + STIR_CELLS); x++) {
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) / STIR_CELLS;
        if (d < 1) heat[y * COLS + x] = Math.max(heat[y * COLS + x], 1 - d * d);
      }
    }
    hot = true;
    anim.start();
  });
  again.addEventListener('click', () => {
    if (reduce) return;
    k = 0;
    play();
  });
  again.hidden = reduce;

  new ResizeObserver(() => {
    size();
    draw();
  }).observe(canvas);
  new MutationObserver(() => {
    size();
    draw();
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  return {
    play,
    pause() {
      running = false;
      anim.stop();
      heat.fill(0);
      hot = false;
      if (k >= 1) replay = true;
      draw();
    },
  };
});
