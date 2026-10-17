// The homepage constellation's island (src/components/Constellation.astro).
//
// State is small: which project is open, which part is forward, and the
// orbit's turn. Each frame, every card gets a target from that state and a
// critically damped spring per property carries it there. Retargeting keeps
// the velocity, so opening, switching and closing blend even mid-move, and
// nothing runs on a clock of its own. Springs step in real time, in small
// steps, so the timing holds when the browser drops frames.
//
// Positions are design px; --u (and U here) fits them to the screen.

type V = { x: number; y: number; z: number; ry: number; s: number; op: number };
const KEYS = ['x', 'y', 'z', 'ry', 's', 'op'] as const;
const K = 95; // stiffness
const C = 2 * Math.sqrt(K); // critical damping
const STEP = 1 / 240;
const DWELL = 280; // ms resting on a project before it opens
const LEAVE = 1400; // ms off every screen before the parts go back in
const TURN = 0.105; // rad/s: about a turn a minute

export function initOrbit(root: HTMLElement) {
  const html = document.documentElement;
  const N = root.querySelectorAll('[data-project]').length;
  const ROW = Number(root.dataset.rowWidth);
  const S0 = Number(root.dataset.s0);
  const GAP = Number(root.dataset.gap);
  const toggle = document.querySelector<HTMLButtonElement>('[data-view-toggle]');

  type Card = { el: HTMLElement; k: number; j: number; at: V; vel: V; to: V; delay: number };
  const zero = (): V => ({ x: 0, y: 0, z: 0, ry: 0, s: 0, op: 0 });
  const cards: Card[] = [...root.querySelectorAll<HTMLElement>('.card')].map((el) => ({
    el,
    k: Number(el.dataset.k),
    j: Number(el.dataset.j),
    at: zero(),
    vel: zero(),
    to: zero(),
    delay: 0,
  }));
  const coverOf = (k: number) => cards.find((c) => c.k === k && c.j === 0)!;
  const partsOf = (k: number) => cards.filter((c) => c.k === k && c.j > 0);

  let open = -1; // the project in the middle, its parts out
  let hot: Card | null = null; // the part forward
  let spin = 0; // the orbit's turn
  let U = 1;
  let H = root.clientHeight;
  let W = root.clientWidth;
  const measure = () => {
    U = Math.min(1, (innerWidth - 48) / ROW);
    H = root.clientHeight;
    W = root.clientWidth;
  };

  // Where everything should be, for the current state, in design px.
  function targets() {
    const others = [...Array(N).keys()].filter((k) => k !== open);
    // The orbit's size: as wide as the screen allows; on a narrow screen,
    // taller instead, so the parts go above and below the project.
    const rx = Math.min(470, Math.max(170, W / U / 2 - 90));
    const narrow = rx < 300;
    const ry = narrow ? 225 : 175;
    // The open project: a little smaller and higher on a narrow screen, so
    // the orbit clears the caption below it.
    const cy = narrow ? -80 : -40;
    for (const c of cards) {
      const t = c.to;
      if (open < 0) {
        // The row, as rendered: every project, parts tucked in their cover.
        const x = (c.k - (N - 1) / 2) * GAP;
        Object.assign(t, { x, y: 0, z: 0, ry: (-x / 600) * 16, s: S0, op: c.j ? 0 : 1 });
        if (c.j) Object.assign(t, { s: 0.2, z: -10 });
      } else if (c.k === open) {
        if (c.j === 0) {
          Object.assign(t, { x: 0, y: cy, z: 0, ry: 0, s: narrow ? 0.8 : 0.95, op: hot ? 0.5 : 1 });
        } else {
          // Out of the cover onto an orbit round it, seen from a little above.
          const m = partsOf(open).length;
          const a = spin + ((c.j - 1) / m) * Math.PI * 2 + Math.PI / 2;
          const x = Math.cos(a) * rx;
          const y = cy + Math.sin(a) * ry;
          const z = Math.sin(a) * 180;
          Object.assign(
            t,
            c === hot
              ? { x: x * 0.82, y: y * 0.82, z: 320, ry: 0, s: 0.8, op: 1 }
              : { x, y, z, ry: -Math.cos(a) * 22, s: 0.42, op: hot ? 0.55 : 0.95 },
          );
        }
      } else {
        // The others wait in a small row along the bottom, parts tucked in.
        const i = others.indexOf(c.k);
        const x = (i - (others.length - 1) / 2) * 150;
        Object.assign(t, { x, y: (H * 0.54 - 72) / U, z: 0, ry: 0, s: 0.3, op: c.j ? 0 : 0.85 });
        if (c.j) t.s = 0.1;
      }
    }
  }

  function step(h: number, now: number) {
    for (const c of cards) {
      if (c.delay > now) continue;
      for (const key of KEYS) {
        c.vel[key] += (K * (c.to[key] - c.at[key]) - C * c.vel[key]) * h;
        c.at[key] += c.vel[key] * h;
      }
    }
  }

  function paint() {
    for (const c of cards) {
      const { x, y, z, ry, s, op } = c.at;
      c.el.style.transform = `translate(-50%, -50%) translate3d(${(x * U).toFixed(1)}px, ${(y * U).toFixed(1)}px, ${(z * U).toFixed(1)}px) rotateY(${ry.toFixed(2)}deg) scale(${Math.max(0, s).toFixed(3)})`;
      const o = Math.max(0, Math.min(1, op));
      c.el.style.opacity = o.toFixed(3);
      c.el.style.zIndex = String(Math.round(1000 + z));
      c.el.style.pointerEvents = o > 0.3 ? '' : 'none';
    }
  }

  // Parts are reachable (Tab, pointer) only while their project is open.
  function reachable() {
    for (const c of cards) if (c.j) c.el.tabIndex = c.k === open ? 0 : -1;
  }

  function openProject(k: number) {
    if (k === open || k < 0 || k >= N) return;
    wake();
    const now = performance.now();
    open = k;
    hot = null;
    // Found: the covers stop beckoning for the rest of the visit.
    root.classList.add('met');
    const cover = coverOf(k);
    // The parts start inside the cover, wherever it is, and come out in turn.
    partsOf(k).forEach((p, i) => {
      Object.assign(p.at, { ...cover.at, s: 0.15, op: 0 });
      p.vel = zero();
      p.delay = now + 260 + i * 70;
    });
    reachable();
  }
  function close() {
    wake();
    open = -1;
    hot = null;
    reachable();
  }

  // Caption: the part forward, else the open project, else the one pointed
  // at. With one project, it stays on it.
  const caption = root.querySelector<HTMLElement>('[data-caption]')!;
  const fields = Object.fromEntries([...caption.querySelectorAll<HTMLElement>('[data-c]')].map((el) => [el.dataset.c, el]));
  let pointed: Card | null = null;
  let captioned: HTMLElement | null = N === 1 ? coverOf(0).el : null;
  function sayCaption() {
    const c = hot ?? (open >= 0 ? coverOf(open) : pointed) ?? (N === 1 ? coverOf(0) : null);
    const el = c?.el ?? null;
    if (el === captioned) return;
    captioned = el;
    caption.classList.remove('in', 'enter');
    if (!el) return;
    void caption.offsetWidth;
    for (const key of ['no', 'kicker', 'title', 'line']) fields[key].textContent = el.dataset[key] ?? '';
    caption.classList.add('in', 'enter');
  }

  // One <video>, moved into the card that's forward (or the open project)
  // once it's there. Muted and inline, never with sound; leaving drops its
  // source so it stops downloading; a clip that fails leaves the still.
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.loop = true;
  video.setAttribute('aria-hidden', 'true');
  video.addEventListener('error', () => video.hasAttribute('src') && detach());
  let playing: HTMLElement | null = null;
  function detach() {
    video.pause();
    video.removeAttribute('src');
    video.load();
    video.remove();
    playing = null;
  }
  function media() {
    const c = html.dataset.homeView === 'index' ? null : (hot ?? (open >= 0 ? coverOf(open) : null));
    if (c && c.at.s < c.to.s * 0.9) return; // not there yet
    const el = c?.el.dataset.video ? c.el : null;
    if (el === playing) return;
    detach();
    if (!el) return;
    playing = el;
    video.src = el.dataset.video!;
    el.append(video);
    video.play().catch(() => {});
  }

  // Pointer (mouse): rest on a project to open it; point at a part to bring
  // it forward; off every screen for a moment, everything goes back.
  let dwell = 0;
  let leave = 0;
  const cardOf = (t: EventTarget | null) => {
    const el = (t as Element | null)?.closest?.('.card');
    return cards.find((c) => c.el === el) ?? null;
  };
  // Listened for on the page: the orbit's layer lets the pointer through
  // everywhere but its cards, so the frame's controls stay reachable.
  document.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    wake();
    const c = cardOf(e.target);
    clearTimeout(leave);
    if (!c) {
      pointed = null;
      hot = null;
      clearTimeout(dwell);
      dwell = 0;
      if (open >= 0) leave = window.setTimeout(close, LEAVE);
      return;
    }
    pointed = c;
    if (c.j === 0) {
      hot = null;
      if (c.k !== open && !dwell) dwell = window.setTimeout(() => ((dwell = 0), openProject(c.k)), DWELL);
    } else {
      clearTimeout(dwell);
      dwell = 0;
      hot = c;
    }
  });
  html.addEventListener('pointerleave', (e) => {
    if (e.pointerType !== 'mouse') return;
    wake();
    clearTimeout(dwell);
    dwell = 0;
    hot = null;
    pointed = null;
    if (open >= 0) leave = window.setTimeout(close, LEAVE);
  });

  // Click and tap: the first press on a closed project opens it, on a part
  // brings it forward; the next press follows the link. A press off every
  // screen puts things back.
  // What was open and forward when the press began: pressing a link
  // focuses it before the click, and focus alone opens a project.
  let touched = false;
  let pressed: { open: number; hot: Card | null } | null = null;
  root.addEventListener('pointerdown', (e) => {
    touched = e.pointerType !== 'mouse';
    pressed = { open, hot };
  });
  root.addEventListener('click', (e) => {
    wake();
    const c = cardOf(e.target);
    const was = pressed ?? { open, hot };
    pressed = null;
    if (!c) return;
    if (c.j === 0 && c.k !== was.open) {
      e.preventDefault();
      openProject(c.k);
    } else if (c.j > 0 && touched && was.hot !== c) {
      e.preventDefault();
      hot = c;
    }
  });
  // A tap off every screen puts things back.
  document.addEventListener('pointerdown', (e) => e.pointerType !== 'mouse' && !cardOf(e.target) && close());

  // Keyboard: focus on a project opens it, on a part brings it forward;
  // ←/→ go between projects; Escape puts everything back.
  root.addEventListener('focusin', (e) => {
    wake();
    const c = cardOf(e.target);
    if (!c) return;
    clearTimeout(leave);
    if (c.j === 0) {
      openProject(c.k);
      hot = null;
    } else hot = c;
  });
  root.addEventListener('focusout', (e) => {
    wake();
    if (!root.contains(e.relatedTarget as Node | null)) (hot = null), (leave = window.setTimeout(close, LEAVE));
  });
  root.addEventListener('keydown', (e) => {
    const c = cardOf(e.target);
    if (!c) return;
    if (e.key === 'Escape') {
      close();
      coverOf(c.k).el.focus({ preventScroll: true });
    } else if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && N > 1) {
      const k = (c.k + (e.key === 'ArrowRight' ? 1 : -1) + N) % N;
      coverOf(k).el.focus({ preventScroll: true });
    } else return;
    e.preventDefault();
  });

  // (Index) / back: the toggle in the frame.
  toggle?.addEventListener('click', () => {
    wake();
    const view = toggle.dataset.view === 'strip' ? 'index' : 'strip';
    toggle.dataset.view = view;
    toggle.setAttribute('aria-label', view === 'strip' ? 'Show as an index' : 'Show the projects');
    if (view === 'index') html.dataset.homeView = 'index';
    else delete html.dataset.homeView;
    close();
  });

  // Posters' dark sources follow the resolved theme, toggle included.
  const syncTheme = () => {
    const t = html.dataset.theme;
    root.querySelectorAll<HTMLSourceElement>('source[data-dark]').forEach((s) => {
      s.media = t === 'dark' ? 'all' : 'not all';
    });
  };
  new MutationObserver(syncTheme).observe(html, { attributes: true, attributeFilter: ['data-theme'] });

  // The other images, only once the first poster has painted: a request in
  // flight before the largest paint delays it, even a lazy image's.
  const rest = () =>
    root.querySelectorAll<HTMLElement>('[data-src], [data-srcset]').forEach((el) => {
      for (const name of ['src', 'srcset']) {
        const value = el.dataset[name];
        if (value) {
          el.setAttribute(name, value);
          el.removeAttribute(`data-${name}`);
        }
      }
    });
  let later = false;
  const once = () => !later && ((later = true), requestAnimationFrame(rest));
  const firstImg = coverOf(0).el.querySelector('img');
  if (PerformanceObserver.supportedEntryTypes?.includes('largest-contentful-paint')) {
    new PerformanceObserver((list, observer) => {
      if (list.getEntries().some((e) => (e as PerformanceEntry & { element?: Element }).element === firstImg)) {
        observer.disconnect();
        once();
      }
    }).observe({ type: 'largest-contentful-paint', buffered: true });
  }
  const fallback = () => setTimeout(once, 1000);
  if (document.readyState === 'complete') fallback();
  else addEventListener('load', fallback, { once: true });

  addEventListener('resize', () => (measure(), wake()));
  measure();
  syncTheme();
  reachable();
  // Start where the page rendered: the row, already in place.
  targets();
  for (const c of cards) Object.assign(c.at, c.to);

  // The loop runs only while something moves: an open orbit turns, and
  // every card springs to rest; then it sleeps until the next change.
  let then = 0;
  let running = false;
  function wake() {
    if (running) return;
    running = true;
    then = performance.now();
    requestAnimationFrame(tick);
  }
  const moving = (now: number) =>
    (open >= 0 && !hot) ||
    cards.some((c) => c.delay > now || KEYS.some((key) => Math.abs(c.to[key] - c.at[key]) > 0.005 || Math.abs(c.vel[key]) > 0.005));
  function tick(now: number) {
    const dt = Math.min(0.6, (now - then) / 1000);
    then = now;
    if (open >= 0 && !hot) spin += TURN * dt;
    targets();
    for (let left = dt; left > 0; left -= STEP) step(Math.min(STEP, left), now);
    paint();
    sayCaption();
    media();
    if (moving(now)) requestAnimationFrame(tick);
    else running = false;
  }
  paint();
}
