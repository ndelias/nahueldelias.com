// Project cards' behaviours, shared by the homepage (home.ts) and the lab's
// layouts (src/lab/home/lab.ts): a card plays its project's reel in place
// while pointed at or focused, and a small tip follows the cursor over
// anything with data-tip. Under reduced motion there are no reels, and the
// tip sits still beside the cursor.

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Frames held back until after the first paint (WorkCard's `later`). */
export function later() {
  for (const img of document.querySelectorAll<HTMLImageElement>('img[data-later-src]')) {
    img.srcset = img.dataset.laterSrcset ?? '';
    img.src = img.dataset.laterSrc!;
    img.removeAttribute('data-later-src');
  }
}

/** Cards marked data-reel play that recording inside their .shot. */
export function reels() {
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

/** One small label, fixed, following the pointer on a light lerp. Mouse
    only: on touch there's no cursor to follow. Styled by .cursor-tip. */
export function tip() {
  const el = document.createElement('div');
  el.className = 'cursor-tip';
  el.setAttribute('aria-hidden', 'true');
  document.body.append(el);
  let x = 0, y = 0, tx = 0, ty = 0, raf = 0, shown = false;
  const loop = () => {
    x += (tx - x) * 0.22;
    y += (ty - y) * 0.22;
    el.style.transform = `translate(${x}px, ${y}px)`;
    raf = Math.abs(tx - x) + Math.abs(ty - y) > 0.3 ? requestAnimationFrame(loop) : 0;
  };
  const hide = () => {
    el.classList.remove('on');
    shown = false;
  };
  addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    const over = (e.target as Element).closest<HTMLElement>('[data-tip]');
    if (!over) return shown && hide();
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
  document.addEventListener('pointerleave', hide);
}
