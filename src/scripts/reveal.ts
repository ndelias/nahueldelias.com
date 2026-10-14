// Case study rows (components/Row.astro), after the first paint:
// - the picture swipes in from its side as its row arrives, once. Rows
//   already on screen when this runs just show, so nothing flashes;
// - pointing at a screen looks closer, where the pointer is;
// - a row's clip plays, muted, while the row is in view, and stops out of it.
// Reduced motion: no swipe, no clips; everything is simply there.

const motion = matchMedia('(prefers-reduced-motion: no-preference)').matches;
const root = document.documentElement;

// Watched through their row: a picture waiting to swipe in is masked to
// nothing, and Chrome counts its own mask, so it would never be seen.
const pictures = [...document.querySelectorAll<HTMLElement>('[data-swipe]')];
const rowOf = (el: HTMLElement) => el.closest<HTMLElement>('[data-row-section]') ?? el;
if (motion) {
  const seen = (el: Element) => {
    const r = el.getBoundingClientRect();
    return r.top < innerHeight && r.bottom > 0;
  };
  pictures.forEach((el) => seen(rowOf(el)) && el.classList.add('in'));
  root.classList.add('reveal-ready');
  const io = new IntersectionObserver(
    (entries) =>
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.querySelectorAll('[data-swipe]').forEach((p) => p.classList.add('in'));
        io.unobserve(e.target);
      }),
    { rootMargin: '0px 0px -12% 0px' },
  );
  pictures.forEach((el) => !el.classList.contains('in') && io.observe(rowOf(el)));
}

for (const screen of document.querySelectorAll<HTMLElement>('[data-loupe]')) {
  screen.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    const r = screen.getBoundingClientRect();
    screen.style.setProperty('--ox', `${(((e.clientX - r.left) / r.width) * 100).toFixed(1)}%`);
    screen.style.setProperty('--oy', `${(((e.clientY - r.top) / r.height) * 100).toFixed(1)}%`);
    screen.classList.add('zoom');
  });
  screen.addEventListener('pointerleave', () => screen.classList.remove('zoom'));
}

if (motion) {
  const clips = new IntersectionObserver(
    (entries) =>
      entries.forEach((e) => {
        const v = e.target as HTMLVideoElement;
        if (e.isIntersecting) {
          if (!v.src && v.dataset.src) v.src = v.dataset.src;
          v.play().then(() => v.classList.add('playing')).catch(() => {});
        } else {
          v.pause();
        }
      }),
    { threshold: 0.4 },
  );
  document.querySelectorAll<HTMLVideoElement>('.case-row video[data-src]').forEach((v) => {
    v.addEventListener('error', () => v.remove());
    clips.observe(v);
  });
}
