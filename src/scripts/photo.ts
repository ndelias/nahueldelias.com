// The homepage's photo arrives as characters: a grid made from the same photo
// (scripts/portrait.mjs → src/assets/about/photo-grid.json) scrambles and
// settles in its place, then the photo fades in over it.
//
// The homepage loads this right away, not after the first paint, and only
// where it plays: from 1024px wide, without reduced motion. The photo is
// safe without it. CSS keeps the photo hidden only there and only while JS
// runs, and shows it on its own after 1.5s whatever happens; if this
// arrives after that, the photo is already there and nothing plays.
import grid from '../assets/about/photo-grid.json';
import { portrait, type Grid } from './portrait';

export function photo() {
  const box = document.querySelector<HTMLElement>('[data-photo]');
  const img = box?.querySelector('img');
  const canvas = box?.querySelector('canvas');
  if (!box || !img || !canvas || box.hasAttribute('data-settling')) return;
  if (Number(getComputedStyle(img).opacity) > 0.5) return;
  box.dataset.settling = '';
  const draw = portrait(canvas, grid as Grid);
  const start = performance.now();
  const step = (t: number) => {
    const k = Math.min(1, (t - start) / 700);
    draw(k);
    if (k < 1) requestAnimationFrame(step);
    else setTimeout(() => (box.dataset.done = ''), 100);
  };
  requestAnimationFrame(step);
}
