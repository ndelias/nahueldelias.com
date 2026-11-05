// /motion's loader, after the first paint. Each piece ([data-piece]) names
// its script in data-src; the script is added when the stage comes within
// half a screen of the viewport, so the page loads only what it shows. Once
// a piece has mounted, it plays while it's on screen and the tab is
// visible, and pauses otherwise. See src/motion/runtime.ts.

import type { Controls, Mount } from '../motion/runtime';

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

interface Piece {
  el: HTMLElement;
  visible: boolean;
  controls?: Controls;
}
const pieces = new Map<string, Piece>();
for (const el of document.querySelectorAll<HTMLElement>('[data-piece]')) pieces.set(el.dataset.piece!, { el, visible: false });

const sync = (p: Piece) => {
  if (!p.controls) return;
  if (p.visible && !document.hidden) p.controls.play?.();
  else p.controls.pause?.();
};

window.__motion = {
  define(id: string, mount: Mount) {
    const p = pieces.get(id);
    if (!p || p.controls) return;
    p.controls = mount(p.el.querySelector<HTMLElement>('[data-stage]')!, { reduce }) || {};
    p.el.classList.add('is-live');
    sync(p);
  },
};

const load = new IntersectionObserver(
  (entries) =>
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      load.unobserve(e.target);
      const s = document.createElement('script');
      s.src = (e.target as HTMLElement).dataset.src!;
      document.head.append(s);
    }),
  { rootMargin: '50% 0px' },
);
const watch = new IntersectionObserver((entries) =>
  entries.forEach((e) => {
    const p = pieces.get((e.target as HTMLElement).dataset.piece!)!;
    p.visible = e.isIntersecting;
    sync(p);
  }),
);
pieces.forEach((p) => {
  load.observe(p.el);
  watch.observe(p.el);
});
document.addEventListener('visibilitychange', () => pieces.forEach(sync));
