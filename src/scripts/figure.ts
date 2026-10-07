// Behaviour for Figure.astro, compiled on its own and added by
// <AfterLoad> once the page has loaded, so none of it is fetched before the
// first paint.
function init() {
  // One observer for every in-view recording on the page. A recording plays
  // while at least a quarter of it is visible, unless the reader paused it.
  const still = matchMedia('(prefers-reduced-motion: reduce)');
  const paused = new WeakSet<HTMLVideoElement>();

  const load = (v: HTMLVideoElement) => {
    if (!v.src && v.dataset.src) v.src = v.dataset.src;
  };
  const start = (v: HTMLVideoElement) => {
    load(v);
    v.play().then(
      () => v.closest('[data-figure]')?.classList.add('playing'),
      () => {},
    );
  };

  const observer = new IntersectionObserver(
    (entries) => {
      for (const { target, isIntersecting } of entries) {
        const v = target as HTMLVideoElement;
        if (isIntersecting && !paused.has(v) && !still.matches) start(v);
        else if (!v.paused) v.pause();
      }
    },
    { threshold: 0.25 },
  );

  // The walkthrough (play="auto") plays as soon as any of it is in view (on
  // a laptop most of it starts below the fold); its corner button pauses and
  // resumes it, and `running` drives the button's icon.
  const autoObserver = new IntersectionObserver(
    (entries) => {
      for (const { target, isIntersecting } of entries) {
        const v = target as HTMLVideoElement;
        if (isIntersecting && !paused.has(v) && !still.matches) start(v);
        else if (!v.paused) v.pause();
      }
    },
    { threshold: 0 },
  );

  const bind = (scope: ParentNode) => {
    for (const figure of scope.querySelectorAll<HTMLElement>('[data-figure]')) {
      if (figure.dataset.bound) continue;
      figure.dataset.bound = '';
      const auto = figure.querySelector<HTMLVideoElement>('video[data-play="auto"]');
      const toggle = figure.querySelector<HTMLButtonElement>('[data-figure-toggle]');
      if (auto && toggle) {
        const label = () => toggle.setAttribute('aria-label', auto.paused ? 'Play walkthrough, muted' : 'Pause walkthrough');
        auto.addEventListener('play', () => (figure.classList.add('running'), label()));
        auto.addEventListener('pause', () => (figure.classList.remove('running'), label()));
        autoObserver.observe(auto);
        toggle.addEventListener('click', () => {
          if (auto.paused) {
            paused.delete(auto);
            start(auto);
          } else {
            paused.add(auto);
            auto.pause();
          }
        });
        // A click anywhere on the recording does the same as the button.
        figure.querySelector('.media')?.addEventListener('click', (event) => {
          if (!toggle.contains(event.target as Node)) toggle.click();
        });
      }

      const v = figure.querySelector<HTMLVideoElement>('video[data-play="view"]');
      if (v) {
        observer.observe(v);
        const button = figure.querySelector<HTMLButtonElement>('[data-figure-pause]')!;
        button.addEventListener('click', () => {
          const pause = !paused.has(v);
          if (pause) {
            paused.add(v);
            v.pause();
          } else {
            paused.delete(v);
            start(v);
          }
          button.setAttribute('aria-pressed', String(pause));
          button.textContent = pause ? '(Play)' : '(Pause)';
        });
      }

      const clickable = figure.querySelector<HTMLVideoElement>('video[data-play="click"]');
      figure.querySelector<HTMLButtonElement>('[data-figure-play]')?.addEventListener('click', (event) => {
        if (!clickable) return;
        (event.currentTarget as HTMLElement).remove();
        clickable.controls = true;
        start(clickable);
        clickable.focus();
      });
    }
  };
  bind(document);
  // A tab swaps in new content (Tabs.astro): set up the figures in it.
  document.addEventListener('tabs:swap', (event) => bind((event as CustomEvent<HTMLElement>).detail));

  // The hero's dark sources follow the theme toggle too.
  const root = document.documentElement;
  const heroDark = document.querySelectorAll<HTMLSourceElement>('source[data-hero][data-dark]');
  if (heroDark.length) {
    new MutationObserver(() => {
      const t = root.dataset.theme;
      heroDark.forEach((s) => (s.media = t ? (t === 'dark' ? 'all' : 'not all') : '(prefers-color-scheme: dark)'));
    }).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
  }

  // Turning reduced motion on mid-visit stops what's playing.
  still.addEventListener('change', () => {
    if (still.matches) for (const v of document.querySelectorAll<HTMLVideoElement>('video[data-play="view"], video[data-play="auto"]')) v.pause();
  });
}

init();

export {}; // a module, so each script keeps its own scope
