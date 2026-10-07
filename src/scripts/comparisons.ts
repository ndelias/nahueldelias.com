// Behaviour for Comparisons.astro, compiled on its own and added by
// <AfterLoad> once the first content has painted: the comparisons become
// tabs, one panel at a time (arrow keys, Home and End move between tabs).
// While the section is in view, each panel shows its before screen, dissolves
// it into today's through a wave of pixels, then hands over to the next tab,
// looping. It stays on the
// tab while the pointer is over the screens or keyboard focus is in the
// section, and Pause stops it. Reduced motion: no fade and no rotation; the
// pair sits side by side and the tabs are manual.
const BEFORE = 2500; // ms on the before screen
const NOW = 3500; // ms on today's, after the reveal

const REVEAL = 2600; // ms for the before screen to dissolve into today's
const BANDS = 12; // vertical bands, each a beat behind the one on its left
const COARSEST = 36; // px per block at the peak, in CSS pixels

// The reveal: drawn on a canvas over the frame. Each band of the screen
// breaks up into ever larger blocks, crossfades from the before screen to
// today's at its coarsest, then resolves back into today's at full detail,
// a little after the band to its left, so the change travels left to
// right as a wave of pixels.
const smooth = (x: number) => x * x * (3 - 2 * x);
function reveal(canvas: HTMLCanvasElement, before: HTMLImageElement, after: HTMLImageElement, done: () => void) {
  const { width: w, height: h } = canvas.getBoundingClientRect();
  const dpr = Math.min(2, devicePixelRatio || 1);
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  const g = canvas.getContext('2d')!;
  const small = document.createElement('canvas').getContext('2d')!;
  // The part of each image the frame shows (object-fit: cover, top).
  const crop = (img: HTMLImageElement) => {
    const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
    const sw = w / scale, sh = h / scale;
    return { img, sx: (img.naturalWidth - sw) / 2, sw, sh };
  };
  const a = crop(before), b = crop(after);
  const bandW = canvas.width / BANDS;
  const lag = 0.45; // how far behind the last band starts, of the whole
  const start = performance.now();
  const frame = (now: number) => {
    const t = Math.min(1, (now - start) / REVEAL);
    g.imageSmoothingEnabled = false;
    for (let k = 0; k < BANDS; k++) {
      const local = Math.min(1, Math.max(0, (t - (k / (BANDS - 1)) * lag) / (1 - lag)));
      // Block size: up to the coarsest and back, smoothly.
      const block = Math.max(1, COARSEST * dpr * Math.sin(Math.PI * smooth(local)));
      const mix = smooth(Math.min(1, Math.max(0, (local - 0.35) / 0.3)));
      const x0 = Math.round(k * bandW), x1 = Math.round((k + 1) * bandW), bw = x1 - x0;
      const cols = Math.max(1, Math.round(bw / block)), rows = Math.max(1, Math.round(canvas.height / block));
      small.canvas.width = cols;
      small.canvas.height = rows;
      for (const [src, alpha] of [[a, 1 - mix], [b, mix]] as const) {
        if (alpha <= 0) continue;
        small.globalAlpha = alpha;
        const sx = src.sx + (x0 / canvas.width) * src.sw, sw = (bw / canvas.width) * src.sw;
        small.drawImage(src.img, sx, 0, sw, src.sh, 0, 0, cols, rows);
      }
      small.globalAlpha = 1;
      g.drawImage(small.canvas, 0, 0, cols, rows, x0, 0, bw, canvas.height);
    }
    if (t < 1) requestAnimationFrame(frame);
    else done();
  };
  requestAnimationFrame(frame);
}

function init() {
  const still = matchMedia('(prefers-reduced-motion: reduce)');
  for (const root of document.querySelectorAll<HTMLElement>('.comparisons')) {
    const list = root.querySelector<HTMLElement>('[data-compare-tabs]');
    if (!list) continue;
    const tabs = [...list.querySelectorAll<HTMLButtonElement>('[data-compare-tab]')];
    const panels = [...root.querySelectorAll<HTMLElement>('[data-compare-panel]')];
    list.setAttribute('role', 'tablist');
    tabs.forEach((tab, i) => {
      tab.setAttribute('role', 'tab');
      tab.id = `compare-tab-${i}`;
      tab.setAttribute('aria-controls', panels[i].id);
      panels[i].setAttribute('role', 'tabpanel');
      panels[i].setAttribute('aria-labelledby', tab.id);
    });

    const pause = document.createElement('button');
    pause.type = 'button';
    pause.className = 'pause';
    root.querySelector('[data-compare-bar]')!.append(pause);

    let at = 0;
    let now = false;
    let paused = false;
    let inView = false;
    let held = false;
    let timer = 0;
    // The fade runs while in view; moving on to the next tab also needs
    // nobody looking closely.
    const running = () => inView && !paused && !still.matches && !(now && held) && !revealing;

    const show = (i: number, focus = false) => {
      at = i;
      now = false;
      tabs.forEach((t, k) => {
        t.setAttribute('aria-selected', String(k === i));
        t.tabIndex = k === i ? 0 : -1;
        panels[k].hidden = k !== i;
        panels[k].classList.remove('now', 'going');
      });
      if (focus) tabs[i].focus();
    };
    const schedule = () => {
      clearTimeout(timer);
      if (running()) timer = window.setTimeout(advance, now ? NOW : BEFORE);
    };
    // Today's screen comes in: through the pixel reveal when both images are
    // ready (otherwise straight), then it simply shows under the canvas,
    // which goes. The next step waits for the reveal to finish.
    let revealing = false;
    function advance() {
      if (now) {
        show((at + 1) % tabs.length);
        schedule();
        return;
      }
      const panel = panels[at];
      const [before, after] = panel.querySelectorAll<HTMLImageElement>('.pair > figure .shot');
      const land = () => {
        now = true;
        panel.classList.remove('going');
        panel.classList.add('now');
        schedule();
      };
      if (!before?.complete || !after?.complete || !before.naturalWidth || !after.naturalWidth) return land();
      revealing = true;
      panel.classList.add('going');
      const canvas = document.createElement('canvas');
      canvas.className = 'reveal';
      canvas.setAttribute('aria-hidden', 'true');
      panel.querySelector('.pair')!.append(canvas);
      reveal(canvas, before, after, () => {
        revealing = false;
        land();
        requestAnimationFrame(() => canvas.remove());
      });
    }
    const sync = () => {
      root.classList.toggle('is-fading', !still.matches);
      pause.hidden = still.matches;
      pause.setAttribute('aria-pressed', String(paused));
      pause.textContent = paused ? '(Play)' : '(Pause)';
      schedule();
    };

    tabs.forEach((t, i) =>
      t.addEventListener('click', () => {
        show(i);
        schedule();
      }),
    );
    list.addEventListener('keydown', (event) => {
      const from = tabs.indexOf(document.activeElement as HTMLButtonElement);
      const n = tabs.length;
      const to = { ArrowRight: (from + 1) % n, ArrowLeft: (from - 1 + n) % n, Home: 0, End: n - 1 }[event.key];
      if (to === undefined) return;
      event.preventDefault();
      show(to, true);
    });
    pause.addEventListener('click', () => {
      paused = !paused;
      sync();
    });
    // Hold while someone is looking closely: pointer over the screens, or
    // keyboard focus anywhere in the section.
    const hold = (on: boolean) => () => {
      held = on;
      schedule();
    };
    const items = root.querySelector<HTMLElement>('.items')!;
    items.addEventListener('pointerenter', hold(true));
    items.addEventListener('pointerleave', hold(false));
    root.addEventListener('focusin', (event) => {
      if ((event.target as Element).matches(':focus-visible')) hold(true)();
    });
    root.addEventListener('focusout', (event) => {
      if (!root.contains(event.relatedTarget as Node)) hold(false)();
    });
    new IntersectionObserver(
      ([e]) => {
        inView = e.isIntersecting;
        schedule();
      },
      { threshold: 0.5 },
    ).observe(items);
    still.addEventListener('change', sync);

    root.classList.add('is-tabbed');
    show(0);
    sync();
  }
}

init();

export {}; // a module, so each script keeps its own scope
