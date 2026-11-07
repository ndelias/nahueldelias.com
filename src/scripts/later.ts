// Behaviour for <Comparisons later />, compiled on its own and added by
// <AfterLoad> once the first content has painted: fetches the section from
// the page's /changes/ page and puts it in place of the heading and link
// that stand in for it. The heading lands where it was, so a link to it
// stays put: a page opened at a link into the section lands on it again
// once it's in, unless the reader has scrolled since. What came in is set up by the behaviours already on the page
// (the tabs:swap event) or by the scripts it carries. If the page can't be
// fetched, the link stays and opens it.
let moved = false;
for (const e of ['wheel', 'touchstart', 'keydown']) addEventListener(e, () => (moved = true), { once: true, passive: true });

async function init() {
  for (const stub of document.querySelectorAll<HTMLElement>('[data-later]')) {
    if (stub.dataset.bound) continue;
    stub.dataset.bound = '';
    const html = await fetch(stub.dataset.later!)
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(String(r.status)))))
      .catch(() => null);
    const from = html && new DOMParser().parseFromString(html, 'text/html').querySelector('[data-later-content]');
    if (!from) continue;
    const fresh = document.createDocumentFragment();
    for (const node of from.childNodes) {
      const copy = document.importNode(node, true);
      // Scripts parsed into another document don't run when moved; fresh
      // copies do (AfterLoad's skip a behaviour that's already loaded).
      const scripts = copy instanceof Element ? [...(copy.matches('script') ? [copy] : []), ...copy.querySelectorAll('script')] : [];
      let out: Node = copy;
      for (const old of scripts) {
        const s = document.createElement('script');
        for (const { name, value } of old.attributes) s.setAttribute(name, value);
        s.textContent = old.textContent;
        if (old === copy) out = s;
        else old.replaceWith(s);
      }
      fresh.append(out);
    }
    const section = fresh.querySelector<HTMLElement>('section');
    const id = decodeURIComponent(location.hash.slice(1));
    const linked = !!id && !!stub.querySelector(`[id="${CSS.escape(id)}"]`);
    stub.replaceWith(fresh);
    if (section) document.dispatchEvent(new CustomEvent('tabs:swap', { detail: section }));
    if (linked && !moved) requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView());
  }
}

init();

export {}; // a module, so each script keeps its own scope
