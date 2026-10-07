// Behaviour for Tabs.astro, compiled on its own and added by <AfterLoad>
// once the first content has painted. Each tab is its own page; this
// switches between them in place. Once the page is idle the other tabs'
// pages are fetched (or on pointing at a tab, if that's sooner); choosing
// one swaps the content below the row for that page's, puts its URL in the
// address bar and its title on the tab, and Back and Forward swap back.
// What came in is set up by the behaviours already on the page (the
// tabs:swap event) or by the scripts it carries. A quick fade in, none under
// reduced motion. If a page can't be fetched, the link just loads it.
const FADE_MS = 400;

function init() {
  const root = document.querySelector<HTMLElement>('[data-tabs]');
  if (!root || root.dataset.bound) return;
  root.dataset.bound = '';
  const still = matchMedia('(prefers-reduced-motion: reduce)');
  const links = [...root.querySelectorAll<HTMLAnchorElement>('[data-tab-link]')];
  const pages = new Map<string, Promise<Document | null>>();
  const key = (href: string) => new URL(href, location.href).pathname;

  const load = (href: string) => {
    const url = key(href);
    let page = pages.get(url);
    if (!page) {
      page = fetch(url)
        .then((r) => (r.ok ? r.text() : Promise.reject(new Error(String(r.status)))))
        .then((html) => new DOMParser().parseFromString(html, 'text/html'))
        .catch(() => (pages.delete(url), null));
      pages.set(url, page);
    }
    return page;
  };

  const mark = (url: string) =>
    links.forEach((a) => (key(a.href) === url ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));

  const show = async (url: string, push: boolean) => {
    const page = await load(url);
    const next = page?.querySelector<HTMLElement>('[data-tab-panel]');
    if (!page || !next) {
      location.assign(url);
      return;
    }
    const panel = root.querySelector<HTMLElement>('[data-tab-panel]')!;
    if (panel.dataset.tabPanel === next.dataset.tabPanel) return;
    const fresh = document.importNode(next, true);
    // Scripts parsed into another document don't run when moved; fresh
    // copies do (AfterLoad's skip a behaviour that's already loaded).
    for (const old of fresh.querySelectorAll('script')) {
      const s = document.createElement('script');
      for (const { name, value } of old.attributes) s.setAttribute(name, value);
      s.textContent = old.textContent;
      old.replaceWith(s);
    }
    for (const v of panel.querySelectorAll('video')) v.pause();
    panel.replaceWith(fresh);
    document.dispatchEvent(new CustomEvent('tabs:swap', { detail: fresh }));
    mark(url);
    document.title = page.title;
    if (push) history.pushState({ tab: url }, '', url);
    // Keep the row in view when the new content is shorter.
    if (root.getBoundingClientRect().top < 0) root.scrollIntoView({ block: 'start' });
    if (!still.matches) fresh.animate([{ opacity: 0 }, { opacity: 1 }], { duration: FADE_MS, easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)' });
  };

  for (const a of links) {
    a.addEventListener('pointerenter', () => load(a.href), { once: true });
    a.addEventListener('click', (event) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      if (key(a.href) !== location.pathname) show(key(a.href), true);
    });
  }
  history.replaceState({ tab: location.pathname }, '');
  addEventListener('popstate', (event) => {
    if ((event.state as { tab?: string } | null)?.tab) show(location.pathname, false);
  });

  const idle = (f: () => void) => ('requestIdleCallback' in window ? requestIdleCallback(f, { timeout: 3000 }) : setTimeout(f, 1500));
  idle(() => links.forEach((a) => key(a.href) !== location.pathname && load(a.href)));
}

init();

export {}; // a module, so each script keeps its own scope
