// /motion's loader, after the first paint. Each piece ([data-piece]) names
// its script in data-src; the script is added when the stage comes within
// half a screen of the viewport, so the page loads only what it shows. Once
// a piece has mounted, it plays while it's on screen and the tab is
// visible, and pauses otherwise. See src/motion/runtime.ts.
//
// The pieces are split across pages for the HTML budget (src/lib/motion.ts).
// When the "More pieces" link comes within a screen and a half, the next
// page is fetched and its pieces appended here, with its styles; the link
// then points at the page after, until there's none. If a fetch fails, the
// link still loads the page.

import type { Controls, Mount } from '../motion/runtime';

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

interface Piece {
  el: HTMLElement;
  visible: boolean;
  controls?: Controls;
}
const pieces = new Map<string, Piece>();

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
const add = (el: HTMLElement) => {
  if (pieces.has(el.dataset.piece!)) return;
  pieces.set(el.dataset.piece!, { el, visible: false });
  load.observe(el);
  watch.observe(el);
};
document.querySelectorAll<HTMLElement>('[data-piece]').forEach(add);
document.addEventListener('visibilitychange', () => pieces.forEach(sync));

// The next page's pieces, appended as the end of this one nears.
const list = document.querySelector<HTMLElement>('[data-pieces]');
const nav = document.querySelector<HTMLElement>('[data-motion-more]');
const styles = new Set([...document.querySelectorAll('style')].map((st) => st.textContent));
const done = () => document.documentElement.setAttribute('data-motion-done', '');
let busy = false;
const more = async () => {
  const next = nav?.querySelector<HTMLAnchorElement>('a[rel="next"]');
  if (!list || !nav || !next) return done();
  if (busy) return;
  busy = true;
  try {
    const r = await fetch(next.href);
    if (!r.ok) throw new Error(String(r.status));
    const page = new DOMParser().parseFromString(await r.text(), 'text/html');
    // Its stages' styles. A page carries all its CSS in one block, most of
    // it the same as this page's; the same rules again change nothing.
    for (const st of page.querySelectorAll('head style')) {
      if (styles.has(st.textContent)) continue;
      styles.add(st.textContent);
      document.head.append(document.importNode(st, true));
    }
    page.querySelectorAll<HTMLElement>('[data-pieces] > [data-piece]').forEach((li) => {
      const el = document.importNode(li, true);
      list.append(el);
      add(el);
    });
    const after = page.querySelector<HTMLAnchorElement>('[data-motion-more] a[rel="next"]');
    if (after) next.href = after.href;
    else {
      nav.remove();
      done();
    }
  } catch {
    // The link stays: following it loads the page.
  } finally {
    busy = false;
  }
  // Still near the end (a tall screen, or a fast scroll): keep going.
  if (nav?.isConnected && nav.getBoundingClientRect().top < innerHeight * 2.5) more();
};
if (nav) {
  // On a following page, the way back is a link; here the pieces continue.
  nav.querySelector('a[rel="prev"]')?.remove();
  new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && more(), { rootMargin: '150% 0px' }).observe(nav);
} else done();
