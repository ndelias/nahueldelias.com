// M05, read to sign, rebuilt from vers1ons' agreement reader
// (useAgreementScroll and its markers). On every scroll frame it measures:
// the section under the sticky header (the last whose top is within the
// header's reach), the sections read (any whose top has come into the top
// three quarters of the view), and how far through the text it is, drawn as
// a bar scaled, not sized, so nothing lays out. Reaching the end, which only
// counts once the reader has scrolled (or the text fits without scrolling,
// so the gate can't deadlock), turns the lock into a check, says so to
// screen readers, and unlocks the acknowledgement and Sign. A contents item
// scrolls its section under the header and flashes it for 1.2s; under
// reduced motion it jumps. Signing, then a moment, starts it over here.

import { define } from '../runtime';

const STICKY = 8; // px: a section is "under the header" this close to the top
const FLASH_MS = 1200;

define('read-to-sign', (stage, { reduce }) => {
  const reader = stage.querySelector<HTMLElement>('[data-reader]')!;
  const box = reader.querySelector<HTMLElement>('[data-scroll]')!;
  const sections = [...box.querySelectorAll<HTMLElement>('[data-section]')];
  const jumps = new Map([...reader.querySelectorAll<HTMLButtonElement>('[data-jump]')].map((b) => [b.dataset.jump!, b]));
  const current = reader.querySelector<HTMLElement>('[data-current]')!;
  const bar = reader.querySelector<HTMLElement>('[data-progress]')!;
  const status = reader.querySelector<HTMLElement>('[data-read-status]')!;
  const ack = reader.querySelector<HTMLInputElement>('[data-ack]')!;
  const sign = reader.querySelector<HTMLButtonElement>('[data-sign]')!;

  let scrolled = false;
  let reached = false;
  let frame = 0;

  const reach = () => {
    if (reached) return;
    reached = true;
    reader.classList.add('done');
    status.textContent = "You've reached the end";
    ack.disabled = false;
  };
  const measure = () => {
    frame = 0;
    const top = box.getBoundingClientRect().top;
    let at = sections[0];
    for (const s of sections) {
      const offset = s.getBoundingClientRect().top - top;
      if (offset <= STICKY + 16) at = s;
      if (offset < box.clientHeight * 0.75) jumps.get(s.dataset.section!)?.classList.add('seen');
    }
    const id = at.dataset.section!;
    current.textContent = `${id} · ${at.querySelector('h3')!.textContent!.replace(/^\d+\. /, '')}`;
    jumps.forEach((b, key) => b.setAttribute('aria-current', String(key === id)));
    const max = box.scrollHeight - box.clientHeight;
    bar.style.setProperty('--read', (max <= 0 ? 1 : Math.min(1, box.scrollTop / max)).toFixed(3));
    if ((scrolled && box.scrollTop + box.clientHeight >= box.scrollHeight - 10) || max <= 4) reach();
  };
  box.addEventListener(
    'scroll',
    () => {
      scrolled = true;
      frame ||= requestAnimationFrame(measure);
    },
    { passive: true },
  );
  new ResizeObserver(() => (frame ||= requestAnimationFrame(measure))).observe(box);

  jumps.forEach((b, id) =>
    b.addEventListener('click', () => {
      const target = sections.find((s) => s.dataset.section === id)!;
      box.scrollTo({ top: target.offsetTop - box.offsetTop - STICKY, behavior: reduce ? 'auto' : 'smooth' });
      target.classList.add('flash');
      requestAnimationFrame(() => requestAnimationFrame(() => target.classList.remove('flash')));
      setTimeout(() => target.classList.remove('flash'), FLASH_MS);
    }),
  );

  ack.addEventListener('change', () => (sign.disabled = !ack.checked));
  sign.addEventListener('click', () => {
    sign.textContent = 'Signed';
    sign.disabled = true;
    ack.disabled = true;
    status.textContent = 'Signed';
    // Start over, so the next visitor gets the whole thing.
    setTimeout(() => {
      reached = scrolled = false;
      reader.classList.remove('done');
      jumps.forEach((b) => b.classList.remove('seen'));
      ack.checked = false;
      sign.textContent = 'Sign';
      status.textContent = 'Keep reading to sign';
      box.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
      requestAnimationFrame(measure);
    }, 2400);
  });

  measure();
});
