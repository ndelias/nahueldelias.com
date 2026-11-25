// The homepage's behaviours (src/pages/index.astro), loaded after the first
// paint: the cards' frames held back until now, their reels and cursor tip,
// the lines (lines.ts), and the meadow that closes the page, built and
// brought in once a quarter of it is on screen. (The photo's characters,
// photo.ts, load sooner: see index.astro.)
import { later, reels, tip } from './cards';
import { thread, tree } from './lines';
import { meadow } from './meadow';

later();
reels();
tip();
const footer = document.querySelector<HTMLCanvasElement>('[data-meadow]');
if (footer) {
  const io = new IntersectionObserver(
    ([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      meadow(footer, 'bottom');
    },
    // A quarter on screen, so the arrival is seen, not missed below the fold.
    { threshold: 0.25 },
  );
  io.observe(footer);
}

// The lines: the thread down the page and the tree in About me.
const lined = document.querySelector<HTMLElement>('[data-lines]');
if (lined) {
  const kinds = (lined.dataset.lines ?? '').split(' ');
  if (kinds.includes('thread')) thread(lined);
  if (kinds.includes('tree')) tree(lined);
}
