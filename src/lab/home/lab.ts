// The lab layouts' behaviours: the cards' reels and cursor tip (shared with
// the homepage, src/scripts/cards.ts), and the character portrait, which
// scrambles and settles once it's on screen (drawn settled under reduced
// motion).
import { later, reels, tip } from '../../scripts/cards';
import { meadow } from '../../scripts/meadow';
import { connector, thread, tree } from '../lines';
import { photo } from '../../scripts/photo';
import { portrait } from '../../scripts/portrait';

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- The portrait ---------- */
function portraits() {
  for (const canvas of document.querySelectorAll<HTMLCanvasElement>('[data-lab-portrait]')) {
    const draw = portrait(canvas);
    if (reduce) {
      draw(1);
      continue;
    }
    draw(0);
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const start = performance.now();
      const step = (t: number) => {
        const k = Math.min(1, (t - start) / 1400);
        draw(k);
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }, { threshold: 0.3 });
    io.observe(canvas);
  }
}

later();
reels();
tip();
document.fonts.ready.then(() => {
  portraits();
  photo();
});

// Round 4: the meadow closing the page, and the line treatment marked on
// the layout.
const footer = document.querySelector<HTMLCanvasElement>('[data-meadow]');
if (footer) {
  const io = new IntersectionObserver(
    ([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      meadow(footer, 'bottom');
    },
    { threshold: 0.25 },
  );
  io.observe(footer);
}
const lined = document.querySelector<HTMLElement>('[data-lines]');
const LINES = { thread, tree, connector };
if (lined) LINES[lined.dataset.lines as keyof typeof LINES]?.(lined);
