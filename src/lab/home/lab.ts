// The lab layouts' behaviours: a card plays its project's reel in place
// while pointed at or focused, a small tip follows the cursor over anything
// with data-tip, and the character portrait scrambles and settles once it's
// on screen. Under reduced motion: no reels, the tip sits still beside the
// cursor, and the portrait is drawn settled.
import { portrait } from '../../scripts/portrait';

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- Reels ---------- */
function reels() {
  if (reduce) return;
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.loop = true;
  video.setAttribute('aria-hidden', 'true');
  let on: HTMLElement | null = null;
  const stop = () => {
    video.pause();
    video.removeAttribute('src');
    video.load();
    video.remove();
    on = null;
  };
  video.addEventListener('error', () => video.hasAttribute('src') && stop());
  const play = (card: HTMLElement) => {
    if (on === card) return;
    stop();
    const shot = card.querySelector('.shot');
    if (!shot) return;
    on = card;
    video.src = card.dataset.reel!;
    shot.append(video);
    video.play().catch(() => {});
  };
  for (const card of document.querySelectorAll<HTMLElement>('[data-reel]')) {
    card.addEventListener('pointerenter', (e) => e.pointerType === 'mouse' && play(card));
    card.addEventListener('pointerleave', (e) => e.pointerType === 'mouse' && on === card && stop());
    card.addEventListener('focus', () => card.matches(':focus-visible') && play(card));
    card.addEventListener('blur', () => on === card && stop());
  }
}

/* ---------- The cursor tip ----------
   One small label, fixed, following the pointer on a spring-ish lerp. Mouse
   only: on touch there's no cursor to follow. */
function tip() {
  const el = document.createElement('div');
  el.className = 'lab-tip mono';
  el.setAttribute('aria-hidden', 'true');
  document.body.append(el);
  let x = 0, y = 0, tx = 0, ty = 0, raf = 0, shown = false;
  const loop = () => {
    x += (tx - x) * 0.22;
    y += (ty - y) * 0.22;
    el.style.transform = `translate(${x}px, ${y}px)`;
    raf = Math.abs(tx - x) + Math.abs(ty - y) > 0.3 ? requestAnimationFrame(loop) : 0;
  };
  addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    const over = (e.target as Element).closest<HTMLElement>('[data-tip]');
    if (!over) {
      if (shown) el.classList.remove('on'), (shown = false);
      return;
    }
    el.textContent = over.dataset.tip!;
    tx = e.clientX + 14;
    ty = e.clientY + 18;
    if (!shown || reduce) {
      x = tx;
      y = ty;
      el.style.transform = `translate(${x}px, ${y}px)`;
    }
    if (!shown) el.classList.add('on'), (shown = true);
    if (!reduce && !raf) raf = requestAnimationFrame(loop);
  });
  document.addEventListener('pointerleave', () => el.classList.remove('on'), (shown = false));
}

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
document.fonts.ready.then(portraits);
