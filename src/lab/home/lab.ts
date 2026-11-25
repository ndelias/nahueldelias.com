// The lab layouts' behaviours: the cards' reels and cursor tip (shared with
// the homepage, src/scripts/cards.ts), and the character portrait, which
// scrambles and settles once it's on screen (drawn settled under reduced
// motion).
import { reels, tip } from '../../scripts/cards';
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

reels();
tip();
document.fonts.ready.then(() => {
  portraits();
  photo();
});
