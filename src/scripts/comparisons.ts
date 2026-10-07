// Behaviour for Comparisons.astro, compiled on its own and added by
// <AfterLoad> once the first content has painted: the comparisons become
// tabs, one panel at a time (arrow keys, Home and End move between tabs).
// While the section is in view, each panel shows its before screen, fades
// today's in over it, then hands over to the next tab, looping. It stays on the
// tab while the pointer is over the screens or keyboard focus is in the
// section, and Pause stops it. Reduced motion: no fade and no rotation; the
// pair sits side by side and the tabs are manual.
const BEFORE = 2500; // ms on the before screen
const NOW = 4500; // ms on today's, fade included

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
    const running = () => inView && !paused && !still.matches && !(now && held);

    const show = (i: number, focus = false) => {
      at = i;
      now = false;
      tabs.forEach((t, k) => {
        t.setAttribute('aria-selected', String(k === i));
        t.tabIndex = k === i ? 0 : -1;
        panels[k].hidden = k !== i;
        panels[k].classList.remove('now');
      });
      if (focus) tabs[i].focus();
    };
    const schedule = () => {
      clearTimeout(timer);
      if (running()) timer = window.setTimeout(advance, now ? NOW : BEFORE);
    };
    function advance() {
      if (now) show((at + 1) % tabs.length);
      else {
        now = true;
        panels[at].classList.add('now');
      }
      schedule();
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
