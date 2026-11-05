// M08, scramble and settle: the About page's portrait (src/scripts/about.ts,
// portrait()), drawn the same way. A grid of characters made from the photo
// (scripts/portrait.mjs). Each cell has a moment, roughly top to bottom with
// scatter; until a quarter before it, the cell is empty, then it flickers
// through noise characters, then lands on its own. In the dark theme the
// ramp flips (dense for light), so it reads as the photo, not its negative.
// On About it settles as the lines from the steps reach it; here it plays
// over 2.6s when it comes into view, and again on the button. Reduced
// motion: it's simply there.

import portraitGrid from '../../assets/about/portrait.json';
import { define } from '../runtime';
import { loop } from '../spring';

const PLAY_S = 2.6;

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
      const done = k >= settle[i];
      const c = done ? cells[i] : k > settle[i] - 0.25 ? NOISE[(Math.random() * NOISE.length) | 0] : '';
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
    draw();
    return running && k < 1;
  });
  const play = () => {
    if (reduce || k >= 1) return;
    running = true;
    anim.start();
  };
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
    },
  };
});
