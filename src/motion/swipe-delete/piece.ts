// M14, swipe to delete. A row's front follows the pointer to the left once
// the drag is clearly sideways (so a vertical swipe still scrolls), with a
// little resistance to the right. Behind it a Delete layer shows, and its
// icon grows as the drag nears the line, two fifths of the row, to say
// letting go now will delete. Released past the line (or flicked), the front
// slides off and the row's height closes (a grid track from 1fr to 0fr), so
// the rows below rise into its place; short of it, it springs back. An undo
// bar then waits 5s: Undo reopens the latest row and slides the front back
// in, and deleting several in a row lets Undo bring them back one by one.
// Delete or Backspace on a focused row does the same as a swipe. Once the
// undo bar has gone, one button brings back whatever is still deleted. Reduced motion: no slide or
// close, the row simply goes and comes back.

import { define } from '../runtime';
import { Spring, loop } from '../spring';

const LINE = 0.4;
const UNDO_MS = 5000;

define('swipe-delete', (stage, { reduce }) => {
  const root = stage.querySelector<HTMLElement>('[data-drafts]')!;
  const undo = root.querySelector<HTMLElement>('[data-undo]')!;
  const undoText = root.querySelector<HTMLElement>('[data-undo-text]')!;
  const restore = root.querySelector<HTMLButtonElement>('[data-restore]')!;
  const said = root.querySelector<HTMLElement>('[data-said]')!;
  const items = [...root.querySelectorAll<HTMLLIElement>('[data-item]')].map((li) => ({
    li,
    front: li.querySelector<HTMLElement>('[data-front]')!,
    behind: li.querySelector<HTMLElement>('.behind')!,
    x: new Spring(0, 240),
    gone: false,
    closing: 0,
  }));
  type Item = (typeof items)[number];
  // Deleted rows, latest last: Undo brings back one at a time, newest first.
  const deleted: Item[] = [];
  let timer = 0;
  const title = (it: Item) => it.front.querySelector('.title')!.textContent;

  const draw = (it: Item) => {
    it.front.style.transform = `translateX(${it.x.value.toFixed(1)}px)`;
    const reach = Math.min(1, -it.x.value / (it.front.offsetWidth * LINE));
    it.behind.style.setProperty('--arm', (0.7 + Math.max(0, reach) * 0.5).toFixed(3));
    it.behind.style.opacity = it.x.value < -1 ? '1' : '0';
  };
  const anim = loop((dt) => {
    let moving = false;
    for (const it of items) {
      if (it.x.resting(0.1)) it.x.snap();
      else {
        it.x.step(dt);
        moving = true;
      }
      draw(it);
    }
    return moving;
  });

  const remove = (it: Item) => {
    it.gone = true;
    it.x.target = -it.front.offsetWidth - 20;
    if (reduce) it.x.snap();
    anim.start();
    // Close the gap once the front is mostly off (cancelled if undone first).
    it.closing = window.setTimeout(() => it.li.classList.add('gone'), reduce ? 0 : 160);
    it.front.tabIndex = -1;
    deleted.push(it);
    said.textContent = `${title(it)} deleted. Undo is available.`;
    offer();
    // Keep focus in the list: the next row, or the one before.
    const next = items.find((i, k) => k > items.indexOf(it) && !i.gone) ?? [...items].reverse().find((i) => !i.gone);
    if (document.activeElement === it.front) (next?.front ?? undo.querySelector('button')!).focus();
  };
  // The undo bar names the latest deletion and lasts 5s from it; after
  // that, anything still gone can come back with the button below.
  const offer = () => {
    clearTimeout(timer);
    const it = deleted.at(-1);
    undo.hidden = !it;
    if (it) {
      const more = deleted.length - 1;
      undoText.textContent = `${title(it)} deleted${more ? ` (and ${more} more)` : ''}`;
      timer = window.setTimeout(() => {
        deleted.length = 0;
        undo.hidden = true;
        restore.hidden = !items.some((i) => i.gone);
      }, UNDO_MS);
    }
    restore.hidden = !undo.hidden || !items.some((i) => i.gone);
  };
  const bring = (it: Item) => {
    clearTimeout(it.closing);
    it.gone = false;
    it.li.classList.remove('gone');
    it.front.tabIndex = 0;
    setTimeout(() => {
      it.x.target = 0;
      if (reduce) it.x.snap();
      anim.start();
    }, reduce ? 0 : 120);
  };

  root.querySelector('[data-undo-button]')!.addEventListener('click', () => {
    const it = deleted.pop();
    if (!it) return;
    bring(it);
    it.front.focus();
    said.textContent = `${title(it)} restored.`;
    offer();
  });
  restore.addEventListener('click', () => {
    items.filter((i) => i.gone).forEach(bring);
    deleted.length = 0;
    offer();
    items[0].front.focus();
  });

  for (const it of items) {
    let start: { x: number; y: number; t: number } | null = null;
    let sideways = false;
    let v = 0;
    let at = 0;
    it.front.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || it.gone) return;
      start = { x: e.clientX, y: e.clientY, t: e.timeStamp };
      at = e.clientX;
      v = 0;
      sideways = false;
    });
    it.front.addEventListener('pointermove', (e) => {
      if (!start) return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      if (!sideways) {
        if (Math.abs(dy) > 8 && Math.abs(dy) > Math.abs(dx)) return void (start = null);
        if (Math.abs(dx) < 6) return;
        sideways = true;
        it.front.setPointerCapture(e.pointerId);
      }
      v = (e.clientX - at) / Math.max(1, e.timeStamp - start.t);
      at = e.clientX;
      start.t = e.timeStamp;
      it.x.value = it.x.target = dx > 0 ? dx * 0.2 : dx;
      draw(it);
    });
    const end = () => {
      if (!start) return;
      start = null;
      if (!sideways) return;
      if (-it.x.value > it.front.offsetWidth * LINE || v < -0.8) remove(it);
      else {
        it.x.target = 0;
        anim.start();
      }
    };
    it.front.addEventListener('pointerup', end);
    it.front.addEventListener('pointercancel', end);
    it.front.addEventListener('keydown', (e) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        remove(it);
      }
    });
    draw(it);
  }
});
