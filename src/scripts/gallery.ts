// Behaviour for Gallery.astro, compiled on its own and added by
// <AfterLoad> once the page has loaded, so none of it is fetched before the
// first paint.
function init() {
  for (const root of document.querySelectorAll<HTMLElement>('[data-gallery]')) {
    const links = [...root.querySelectorAll<HTMLAnchorElement>('[data-gallery-open]')];
    const all = root.querySelector<HTMLAnchorElement>('[data-gallery-all]');
    // Every screen, on the page or viewer-only, in order.
    interface Shot { full: string; width: number; height: number; alt: string; caption: string }
    const shots: Shot[] = [];
    for (const link of links) {
      const thumb = link.querySelector('img')!;
      shots[Number(link.dataset.galleryOpen)] = {
        full: link.getAttribute('href')!,
        width: Number(link.dataset.width),
        height: Number(link.dataset.height),
        alt: thumb.alt,
        caption: link.closest('figure')!.querySelector('.text')?.textContent ?? '',
      };
    }
    // Viewer-only screens: fetched the first time the viewer opens.
    let extra: Promise<void> | undefined;
    const loadExtra = () =>
      (extra ??= all?.dataset.extraUrl
        ? fetch(all.dataset.extraUrl)
            .then((r) => r.json())
            .then((list: (Shot & { index: number })[]) => {
              for (const e of list) shots[e.index] = e;
            })
            .catch(() => {})
        : Promise.resolve());
    const size = () => Number(all?.dataset.total ?? shots.length);
    const dialog = root.querySelector<HTMLDialogElement>('[data-gallery-viewer]')!;
    const img = dialog.querySelector<HTMLImageElement>('[data-viewer-img]')!;
    const caption = dialog.querySelector<HTMLElement>('[data-viewer-caption]')!;
    const count = dialog.querySelector<HTMLElement>('[data-viewer-count]')!;
    const total = () => String(size()).padStart(2, '0');
    let at = 0;
    let opener: HTMLElement | null = null;

    const show = (i: number) => {
      at = (i + size()) % size();
      const shot = shots[at];
      if (!shot) {
        loadExtra().then(() => shots[at] && show(at));
        return;
      }
      img.src = shot.full;
      img.width = shot.width;
      img.height = shot.height;
      img.alt = shot.alt;
      caption.textContent = shot.caption || shot.alt;
      count.textContent = `${String(at + 1).padStart(2, '0')} / ${total()}`;
    };

    const open = (link: HTMLAnchorElement, i: number) =>
      link.addEventListener('click', (event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return; // new tab: let it
        event.preventDefault();
        opener = link;
        loadExtra();
        show(i);
        dialog.showModal();
      });
    for (const link of links) open(link, Number(link.dataset.galleryOpen));
    if (all) open(all, 0);
    dialog.querySelector('[data-viewer-close]')!.addEventListener('click', () => dialog.close());
    dialog.querySelector('[data-viewer-prev]')!.addEventListener('click', () => show(at - 1));
    dialog.querySelector('[data-viewer-next]')!.addEventListener('click', () => show(at + 1));
    dialog.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowLeft') show(at - 1);
      else if (event.key === 'ArrowRight') show(at + 1);
      else return;
      event.preventDefault();
    });
    // A click on the backdrop (outside the dialog's box) closes it.
    dialog.addEventListener('click', (event) => {
      if (event.target !== dialog) return;
      const r = dialog.getBoundingClientRect();
      const inside = event.clientX >= r.left && event.clientX <= r.right && event.clientY >= r.top && event.clientY <= r.bottom;
      if (!inside) dialog.close();
    });
    dialog.addEventListener('close', () => {
      img.removeAttribute('src');
      opener?.focus();
    });
    root.classList.add('is-live');
  }
}

init();

export {}; // a module, so each script keeps its own scope
