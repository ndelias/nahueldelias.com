// M10, the number ticker. The total is one window per digit, each holding a
// column of 0–9 that slides (a CSS transform transition) to show its digit.
// On a change every digit rolls the short way to its new value, the ones
// column first and each column to its left 40ms later, so the number reads
// as counting, not flipping. When the number gains or loses a digit (or a
// comma), its windows are rebuilt at 0 and roll up to the new value, while
// the number's width eases from the old to the new. The digits are hidden
// from screen readers: they read the plain total, and a live region says
// each new one once. Reduced motion: the digits change in place.

import { define } from '../runtime';

const STAGGER_MS = 40;
const format = (n: number) => n.toLocaleString('en-US');

define('number-ticker', (stage, { reduce }) => {
  const root = stage.querySelector<HTMLElement>('[data-ticker]')!;
  const num = root.querySelector<HTMLElement>('[data-num]')!;
  const text = root.querySelector<HTMLElement>('[data-text]')!;
  const said = root.querySelector<HTMLElement>('[data-said]')!;
  let value = Number(num.dataset.value);
  let shape = '';
  let cols: HTMLElement[] = [];

  // Windows for a formatted number; each column starts at `start`, or at its
  // own digit when start is null.
  const build = (formatted: string, start: number | null) => {
    num.textContent = '';
    cols = [];
    shape = formatted.replace(/\d/g, '0');
    for (const ch of formatted) {
      if (ch === ',') {
        num.append(',');
        continue;
      }
      const win = document.createElement('span');
      win.className = 'digit';
      const col = document.createElement('span');
      col.className = 'col';
      for (let d = 0; d <= 9; d++) col.append(Object.assign(document.createElement('span'), { textContent: String(d) }));
      col.style.transform = `translateY(${-(start ?? Number(ch))}em)`;
      win.append(col);
      num.append(win);
      cols.push(col);
    }
  };
  const roll = (formatted: string) => {
    const digits = formatted.replace(/,/g, '');
    cols.forEach((col, i) => {
      col.style.setProperty('--delay', `${(cols.length - 1 - i) * STAGGER_MS}ms`);
      col.style.transform = `translateY(${-Number(digits[i])}em)`;
    });
  };

  const set = (next: number) => {
    const formatted = format(next);
    if (next === value) return;
    value = next;
    text.textContent = `$${formatted}`;
    said.textContent = `Royalties paid, $${formatted}`;
    if (reduce) return build(formatted, null);
    if (formatted.replace(/\d/g, '0') === shape) return roll(formatted);
    // A new shape: ease the width from the old number's to the new one's.
    num.style.width = '';
    const from = num.getBoundingClientRect().width;
    build(formatted, 0);
    const to = num.getBoundingClientRect().width;
    num.style.width = `${from}px`;
    num.getBoundingClientRect(); // commit the old width before easing
    num.style.width = `${to}px`;
    requestAnimationFrame(() => requestAnimationFrame(() => roll(formatted)));
  };
  num.addEventListener('transitionend', (e) => {
    if (e.target === num) num.style.width = '';
  });

  build(format(value), null);
  root.querySelectorAll<HTMLButtonElement>('[data-add]').forEach((b) =>
    b.addEventListener('click', () => set(Math.max(0, value + Number(b.dataset.add)))),
  );
});
