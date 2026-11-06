// M12, the toast stack. Each notice is placed by springs (its rise, scale,
// sideways offset and fade) toward a target set by the stack's state:
// - stacked: the newest in front, each older one tucked 10px higher and 5%
//   smaller behind it, three deep, the rest faded away;
// - spread (pointer over the stack, or focus inside it): every notice at
//   full size, one above the other with a gap, and the timers paused.
// A notice leaves after 4s of being visible and not held, or when it's
// swiped right past a third of its width (or flicked), or its × pressed:
// it slides out and fades, and the rest close up behind it. A new one rises
// in from below. Notices are announced by the list's live region.
// Reduced motion: placement jumps, and leaving is a plain removal.

import { define } from '../runtime';
import { Spring, loop } from '../spring';

const LIFE_MS = 4000;
const TUCK = 10;
const GAP = 8;
const DEPTH = 3;
const MESSAGES: [string, string][] = [
  ['Draft saved', 'Just now'],
  ['License sent', 'To the rightsholder'],
  ['Split sheet signed', 'By all three contributors'],
  ['Payout scheduled', 'Arrives Friday'],
  ['Link copied', 'Paste it anywhere'],
];

interface Toast {
  el: HTMLLIElement;
  y: Spring;
  s: Spring;
  x: Spring;
  o: Spring;
  left: number; // ms of life left
  leaving: boolean;
  drag: { from: number; at: number; t: number; v: number } | null;
}

define('toast-stack', (stage, { reduce }) => {
  const root = stage.querySelector<HTMLElement>('[data-toasts]')!;
  const list = root.querySelector<HTMLOListElement>('[data-stack]')!;
  const toasts: Toast[] = []; // newest first
  let spread = false;
  let n = 0;

  const place = () => {
    let rise = 0;
    toasts.forEach((t, i) => {
      if (t.leaving) return;
      const h = t.el.offsetHeight;
      if (spread) {
        t.y.target = rise;
        t.s.target = 1;
        t.o.target = 1;
        rise += h + GAP;
      } else {
        const depth = toasts.slice(0, i).filter((u) => !u.leaving).length;
        t.y.target = depth * TUCK;
        t.s.target = 1 - depth * 0.05;
        t.o.target = depth < DEPTH ? 1 : 0;
      }
      t.el.style.zIndex = String(toasts.length - i);
      t.el.inert = !spread && t !== toasts.find((u) => !u.leaving);
    });
    if (reduce) toasts.forEach((t) => [t.y, t.s, t.o, t.x].forEach((s) => s.snap()));
    anim.start();
  };

  const remove = (t: Toast, dir = 1) => {
    if (t.leaving) return;
    t.leaving = true;
    t.el.inert = true;
    t.x.target = dir * (t.el.offsetWidth + 40);
    t.o.target = 0;
    if (reduce) t.el.remove(), toasts.splice(toasts.indexOf(t), 1);
    place();
  };

  let last = 0;
  const anim = loop((dt) => {
    const now = performance.now();
    const ms = last ? now - last : 0;
    last = now;
    let moving = false;
    for (const t of [...toasts]) {
      if (!spread && !t.leaving && !t.drag) {
        t.left -= ms;
        if (t.left <= 0) remove(t);
      }
      for (const s of [t.y, t.s, t.o, ...(t.drag ? [] : [t.x])]) {
        if (s.resting(0.002)) s.snap();
        else {
          s.step(dt);
          moving = true;
        }
      }
      t.el.style.transform = `translate(${t.x.value.toFixed(1)}px, ${(-t.y.value).toFixed(1)}px) scale(${t.s.value.toFixed(4)})`;
      t.el.style.opacity = Math.max(0, Math.min(1, t.o.value)).toFixed(3);
      if (t.leaving && t.o.value < 0.02) {
        t.el.remove();
        toasts.splice(toasts.indexOf(t), 1);
      }
    }
    // Keep ticking while any notice is counting down.
    const counting = !spread && toasts.some((t) => !t.leaving);
    if (!moving && !counting) last = 0;
    return moving || counting;
  });

  const raise = () => {
    const [title, sub] = MESSAGES[n++ % MESSAGES.length];
    const el = document.createElement('li');
    el.className = 'toast';
    el.innerHTML = `<span class="mark" aria-hidden="true"></span><span class="text"><strong></strong><span></span></span><button type="button" class="close" aria-label="Dismiss"><svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8"/></svg></button>`;
    el.querySelector('strong')!.textContent = title;
    el.querySelector('.text span')!.textContent = sub;
    list.prepend(el);
    const t: Toast = { el, y: new Spring(-24, 220), s: new Spring(1, 220), x: new Spring(0, 220), o: new Spring(0, 220), left: LIFE_MS, leaving: false, drag: null };
    toasts.unshift(t);
    el.querySelector('.close')!.addEventListener('click', () => remove(t));

    // Swipe right to dismiss: the toast follows the pointer (and resists a
    // pull to the left), then leaves past a third of its width or on a flick.
    el.addEventListener('pointerdown', (e) => {
      if ((e.target as HTMLElement).closest('.close')) return;
      el.setPointerCapture(e.pointerId);
      t.drag = { from: e.clientX - t.x.value, at: e.clientX, t: e.timeStamp, v: 0 };
    });
    el.addEventListener('pointermove', (e) => {
      if (!t.drag) return;
      const dx = e.clientX - t.drag.from;
      t.x.value = t.x.target = dx < 0 ? dx * 0.25 : dx;
      t.drag.v = (e.clientX - t.drag.at) / Math.max(1, e.timeStamp - t.drag.t);
      t.drag.at = e.clientX;
      t.drag.t = e.timeStamp;
      anim.start();
    });
    const release = () => {
      if (!t.drag) return;
      const { v } = t.drag;
      t.drag = null;
      if (t.x.value > el.offsetWidth / 3 || v > 0.6) remove(t);
      else {
        t.x.target = 0;
        anim.start();
      }
    };
    el.addEventListener('pointerup', release);
    el.addEventListener('pointercancel', release);
    place();
  };

  const setSpread = (on: boolean) => {
    if (spread === on) return;
    spread = on;
    list.style.height = on ? `${Math.max(64, toasts.filter((t) => !t.leaving).reduce((h, t) => h + t.el.offsetHeight + GAP, 0))}px` : '';
    place();
  };
  list.addEventListener('pointerenter', () => setSpread(true));
  list.addEventListener('pointerleave', () => setSpread(false));
  list.addEventListener('focusin', () => setSpread(true));
  list.addEventListener('focusout', (e) => !list.contains(e.relatedTarget as Node) && setSpread(false));
  root.querySelector('[data-raise]')!.addEventListener('click', raise);
});
