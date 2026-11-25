// The homepage's photo arrives as characters: a grid made from the same photo
// (scripts/portrait.mjs → src/assets/about/photo-grid.json) scrambles and
// settles in its place, then the photo fades in over it.
//
// The photo is safe without this. CSS keeps it hidden only while JS runs
// and the photo is big enough for characters to read (not the phone's small
// row), and shows it on its own after 3s whatever happens. If this arrives
// after that, the photo is already there and nothing plays. Under reduced
// motion the photo is simply there.
import grid from '../assets/about/photo-grid.json';
import { portrait, type Grid } from './portrait';

export function photo() {
  const box = document.querySelector<HTMLElement>('[data-photo]');
  const img = box?.querySelector('img');
  const canvas = box?.querySelector('canvas');
  if (!box || !img || !canvas) return;
  if (Number(getComputedStyle(img).opacity) > 0.5) return;
  box.dataset.settling = '';
  const draw = portrait(canvas, grid as Grid);
  const start = performance.now();
  const step = (t: number) => {
    const k = Math.min(1, (t - start) / 1300);
    draw(k);
    if (k < 1) requestAnimationFrame(step);
    else setTimeout(() => (box.dataset.done = ''), 250);
  };
  requestAnimationFrame(step);
}
