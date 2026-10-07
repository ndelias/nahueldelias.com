// Behaviour for Steps.astro, compiled on its own and added by <AfterLoad>
// once the first content has painted.
const STILL_MS = 5000; // how long a still shows before the next step
const CLIP_MIN_MS = 5000; // a clip shows once through, at least this long

function init(scope: ParentNode = document) {
  const still = matchMedia('(prefers-reduced-motion: reduce)');
  for (const root of scope.querySelectorAll<HTMLElement>('[data-steps]')) {
    if (root.dataset.bound) continue;
    root.dataset.bound = '';
    const track = root.querySelector<HTMLElement>('[data-steps-track]')!;
    const cards = [...track.querySelectorAll<HTMLElement>('[data-step]')];
    // The rail: one numbered link per step, built here (it's only for the
    // JS version).
    const railList = root.querySelector<HTMLOListElement>('[data-steps-rail]')!;
    const rail = cards.map((card) => {
      const li = document.createElement('li');
      const a = document.createElement('a');
      const no = card.querySelector('.no')?.textContent ?? '';
      const title = card.querySelector('.title')?.textContent ?? '';
      a.href = `#${card.id}`;
      a.textContent = no;
      a.setAttribute('aria-label', `Step ${no}${title ? `: ${title}` : ''}`);
      li.append(a);
      railList.append(li);
      return a;
    });
    const pause = root.querySelector<HTMLButtonElement>('[data-steps-pause]')!;
    let current = 0;
    let paused = false;
    let inView = false;
    let held = false;
    let timer = 0;
    root.classList.add('is-live');

    const behavior = (): ScrollBehavior => (still.matches ? 'auto' : 'smooth');
    const go = (i: number) => {
      const card = cards[Math.max(0, Math.min(cards.length - 1, i))];
      track.scrollTo({ left: card.offsetLeft, behavior: behavior() });
    };

    // Advancing: while the section is in view, unless paused, held (pointer
    // on the screens or keyboard focus in the section) or motion is
    // reduced. A still shows for a few seconds, a clip once through; after
    // the last step it starts over. Any change of step, by hand or not,
    // restarts the wait.
    const running = () => inView && !paused && !held && !still.matches;
    const schedule = () => {
      clearTimeout(timer);
      if (!running()) return;
      const v = cards[current].querySelector<HTMLVideoElement>('video');
      const wait = () => (v && v.duration ? Math.max(CLIP_MIN_MS, v.duration * 1000 + 300) : STILL_MS);
      if (v && !v.duration) v.addEventListener('loadedmetadata', schedule, { once: true });
      timer = window.setTimeout(() => go((current + 1) % cards.length), wait());
    };

    // The clip of the showing step plays, muted and looped, while the
    // section is in view, unless paused or motion is reduced. It starts from
    // the top each time its step comes up.
    const sync = () => {
      cards.forEach((card, i) => {
        const v = card.querySelector<HTMLVideoElement>('video');
        if (!v) return;
        const play = i === current && inView && !paused && !still.matches;
        if (play) {
          if (!v.src && v.dataset.src) v.src = v.dataset.src;
          else if (v.paused) v.currentTime = 0;
          v.play().then(() => card.classList.add('playing'), () => {});
        } else if (!v.paused) {
          v.pause();
        }
      });
      schedule();
    };

    const setCurrent = (i: number) => {
      if (i === current && rail[i]?.hasAttribute('aria-current')) return;
      current = i;
      rail.forEach((a, k) => (k === i ? a.setAttribute('aria-current', 'step') : a.removeAttribute('aria-current')));
      // Keep the current number visible in the rail, without moving the page.
      const list = rail[i]?.closest('ol');
      const li = rail[i]?.parentElement;
      if (list && li && list.scrollWidth > list.clientWidth) {
        list.scrollTo({ left: li.offsetLeft - (list.clientWidth - li.offsetWidth) / 2, behavior: behavior() });
      }
      sync();
    };

    const cardObserver = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setCurrent(cards.indexOf(e.target as HTMLElement));
      },
      { root: track, threshold: 0.6 },
    );
    cards.forEach((c) => cardObserver.observe(c));
    new IntersectionObserver(
      ([e]) => {
        inView = e.isIntersecting;
        sync();
      },
      { threshold: 0.25 },
    ).observe(track);

    root.querySelector('[data-steps-prev]')!.addEventListener('click', () => go(current - 1));
    root.querySelector('[data-steps-next]')!.addEventListener('click', () => go(current + 1));
    rail.forEach((a, i) =>
      a.addEventListener('click', (event) => {
        event.preventDefault();
        go(i);
      }),
    );
    track.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowRight') go(current + 1);
      else if (event.key === 'ArrowLeft') go(current - 1);
      else if (event.key === 'Home') go(0);
      else if (event.key === 'End') go(cards.length - 1);
      else return;
      event.preventDefault();
    });
    pause.addEventListener('click', () => {
      paused = !paused;
      pause.setAttribute('aria-pressed', String(paused));
      pause.textContent = paused ? '(Play)' : '(Pause)';
      sync();
    });
    const hold = (on: boolean) => {
      held = on;
      schedule();
    };
    track.addEventListener('pointerenter', () => hold(true));
    track.addEventListener('pointerleave', () => hold(false));
    root.addEventListener('focusin', (event) => {
      if ((event.target as Element).matches(':focus-visible')) hold(true);
    });
    root.addEventListener('focusout', (event) => {
      if (!root.contains(event.relatedTarget as Node)) hold(false);
    });
    const showPause = () => (pause.hidden = still.matches);
    showPause();
    still.addEventListener('change', () => (showPause(), sync()));
  }
}

init();

// A tab swaps in new content (Tabs.astro): set up what came in with it.
document.addEventListener('tabs:swap', (event) => init((event as CustomEvent<HTMLElement>).detail));

export {}; // a module, so each script keeps its own scope
