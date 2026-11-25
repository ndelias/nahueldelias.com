// The homepage's behaviours (src/pages/index.astro), loaded after the first
// paint: the photo arriving as characters (photo.ts), the cards' reels and
// cursor tip, and the meadow that closes the page, built and brought in
// only once it's close to the screen.
import { reels, tip } from './cards';
import { meadow } from './meadow';
import { photo } from './photo';

document.fonts.ready.then(photo);
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
    { rootMargin: '200px 0px' },
  );
  io.observe(footer);
}
