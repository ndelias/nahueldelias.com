// M07, the drop screen swap, rebuilt from vers1ons' useDropScreenSwap, in a
// box of its own instead of the window. From the hero, one wheel tick (over
// 4px), one swipe (over 40px) or Down, Page Down or Space carries the box to
// the top of the details in 800ms on an ease-in-out quart; from there one
// step up carries it back. Inside the details, scrolling up stops at their
// top rather than sliding part way into the hero. Trackpad momentum after a
// swap lands is swallowed for 450ms, and a box left between the two screens
// (a dragged scrollbar, a flick) settles onto one after 140ms of quiet, in
// the direction it was going. As the details rise, the hero's content
// recedes with the scroll (in vers1ons a CSS scroll timeline; here the
// scroll position, so it runs everywhere). Reduced motion: the swaps jump.

import { define } from '../runtime';

const SWAP_MS = 800;
const INERTIA_MS = 450;
const MIN_WHEEL = 4;
const MIN_SWIPE = 40;
const SETTLE_MS = 140;
const quart = (t: number) => (t < 0.5 ? 8 * t ** 4 : 1 - (-2 * t + 2) ** 4 / 2);

define('drop-swap', (stage, { reduce }) => {
  const box = stage.querySelector<HTMLElement>('[data-box]')!;
  const hero = stage.querySelector<HTMLElement>('[data-hero]')!;
  const detail = stage.querySelector<HTMLElement>('[data-detail]')!;
  let busy = false;
  let quietUntil = 0;

  const seam = () => detail.offsetTop;
  const onHero = () => box.scrollTop < seam() - 1;
  const atSeam = () => Math.abs(box.scrollTop - seam()) <= 1;

  const go = (screen: 'hero' | 'detail') => {
    const to = screen === 'detail' ? seam() : 0;
    const from = box.scrollTop;
    if (Math.abs(to - from) < 1) return;
    if (reduce) {
      box.scrollTop = to;
      return;
    }
    busy = true;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / SWAP_MS);
      box.scrollTop = from + (to - from) * quart(t);
      if (t < 1) requestAnimationFrame(step);
      else {
        busy = false;
        quietUntil = performance.now() + INERTIA_MS;
      }
    };
    requestAnimationFrame(step);
  };

  box.addEventListener(
    'wheel',
    (e) => {
      if (e.ctrlKey) return;
      const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      if (busy || performance.now() < quietUntil) {
        if (box.scrollTop <= seam() + 1) e.preventDefault();
        return;
      }
      if (onHero()) {
        e.preventDefault();
        if (dy > MIN_WHEEL) go('detail');
        else if (dy < -MIN_WHEEL) go('hero');
      } else if (atSeam() && dy < -MIN_WHEEL) {
        e.preventDefault();
        go('hero');
      } else if (dy < 0 && box.scrollTop > seam() + 1 && box.scrollTop + dy < seam()) {
        e.preventDefault();
        box.scrollTop = seam();
      }
    },
    { passive: false },
  );

  let startY = 0;
  box.addEventListener('touchstart', (e) => (startY = e.touches[0].clientY), { passive: true });
  box.addEventListener(
    'touchmove',
    (e) => {
      const dy = startY - e.touches[0].clientY;
      if (busy || onHero() || (atSeam() && dy < 0)) e.preventDefault();
    },
    { passive: false },
  );
  box.addEventListener('touchend', (e) => {
    const dy = startY - e.changedTouches[0].clientY;
    if (busy || Math.abs(dy) < MIN_SWIPE) return;
    if (onHero()) go(dy > 0 ? 'detail' : 'hero');
    else if (atSeam() && dy < 0) go('hero');
  });

  box.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey || (e.target as HTMLElement).closest('button')) return;
    const down = ['ArrowDown', 'PageDown', ' '].includes(e.key) && !e.shiftKey;
    const up = ['ArrowUp', 'PageUp'].includes(e.key) || (e.key === ' ' && e.shiftKey);
    if (down && onHero()) {
      e.preventDefault();
      go('detail');
    } else if (up && (onHero() || atSeam())) {
      e.preventDefault();
      go('hero');
    }
  });
  stage.querySelectorAll<HTMLButtonElement>('[data-to]').forEach((b) => b.addEventListener('click', () => go(b.dataset.to as 'hero' | 'detail')));

  // The recede, and settling a box left between the screens.
  let last = 0;
  let direction: 'up' | 'down' = 'down';
  let settle = 0;
  let frame = 0;
  box.addEventListener(
    'scroll',
    () => {
      const y = box.scrollTop;
      if (y !== last) direction = y < last ? 'up' : 'down';
      last = y;
      frame ||= requestAnimationFrame(() => {
        frame = 0;
        hero.style.setProperty('--p', Math.min(1, box.scrollTop / box.clientHeight).toFixed(3));
      });
      clearTimeout(settle);
      settle = window.setTimeout(() => {
        if (!busy && box.scrollTop > 1 && onHero()) go(direction === 'up' ? 'hero' : 'detail');
      }, SETTLE_MS);
    },
    { passive: true },
  );
});
