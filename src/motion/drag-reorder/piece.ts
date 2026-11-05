// M13, drag to reorder. Each row has a slot (its index times the row
// height) and a spring for its y that carries it there. Holding a row lifts
// it (a shadow, a little scale) and it follows the pointer directly, clamped
// to the list; the slot it's over is where it would land, and every other
// row's target shifts to make room, so they glide aside as it passes. (On
// touch, a drag starts from the grip, so the rest of a row scrolls.) On
// release it springs into that slot and the order is kept. The numbers
// follow the order. From the keyboard: Space or Enter picks the focused
// row up, the arrows move it a slot at a time (the others glide the same
// way), Space or Enter drops it, Escape puts it back; each step is
// announced. Reduced motion: rows jump to their slots.

import { define } from '../runtime';
import { Spring, loop } from '../spring';

const ROW = 46; // px: row height plus the gap

define('drag-reorder', (stage, { reduce }) => {
  const root = stage.querySelector<HTMLElement>('[data-playlist]')!;
  const list = root.querySelector<HTMLOListElement>('[data-rows]')!;
  const said = root.querySelector<HTMLElement>('[data-said]')!;
  const rows = [...list.querySelectorAll<HTMLLIElement>('[data-row]')].map((el) => ({ el, y: new Spring(0, 260), s: new Spring(1, 260) }));
  type R = (typeof rows)[number];
  let order: R[] = [...rows];
  let held: { r: R; offset: number; from: number; keys: boolean } | null = null;
  const title = (r: R) => r.el.querySelector('.title')!.textContent;

  const slotOf = (r: R) => order.indexOf(r);
  const layout = () => {
    order.forEach((r, i) => {
      r.el.querySelector('.n')!.textContent = String(i + 1).padStart(2, '0');
      if (held?.r !== r || held.keys) r.y.target = i * ROW;
    });
    if (reduce) rows.forEach((r) => (held?.r === r && !held.keys) || r.y.snap());
    anim.start();
  };
  const draw = () =>
    rows.forEach((r) => {
      r.el.style.transform = `translateY(${r.y.value.toFixed(2)}px) scale(${r.s.value.toFixed(4)})`;
      r.el.style.zIndex = held?.r === r ? '2' : '';
    });
  const anim = loop((dt) => {
    let moving = false;
    for (const r of rows)
      for (const s of [r.y, r.s]) {
        if (held?.r === r && s === r.y && !held.keys) continue;
        if (s.resting(0.01)) s.snap();
        else {
          s.step(dt);
          moving = true;
        }
      }
    draw();
    return moving || !!held;
  });

  // Move a row to a slot, everything else shifting around it.
  const moveTo = (r: R, slot: number) => {
    const to = Math.max(0, Math.min(order.length - 1, slot));
    if (to === slotOf(r)) return false;
    order.splice(slotOf(r), 1);
    order.splice(to, 0, r);
    layout();
    return true;
  };
  const lift = (r: R, keys: boolean, offset = 0) => {
    held = { r, offset, from: slotOf(r), keys };
    r.el.classList.add('held');
    r.s.target = reduce ? 1 : 1.03;
    anim.start();
  };
  const drop = (cancel = false) => {
    if (!held) return;
    const { r, from } = held;
    if (cancel) moveTo(r, from);
    held = null;
    r.el.classList.remove('held');
    r.s.target = 1;
    layout();
    return r;
  };

  // Pointer: follow directly, land on the nearest slot.
  rows.forEach((r) => {
    r.el.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || held) return;
      if (e.pointerType === 'touch' && !(e.target as HTMLElement).closest('.grip')) return;
      r.el.setPointerCapture(e.pointerId);
      lift(r, false, e.clientY - r.y.value);
    });
    r.el.addEventListener('pointermove', (e) => {
      if (held?.r !== r || held.keys) return;
      const y = Math.max(-ROW * 0.3, Math.min((order.length - 1) * ROW + ROW * 0.3, e.clientY - held.offset));
      r.y.value = r.y.target = y;
      moveTo(r, Math.round(y / ROW));
      draw();
    });
    const up = () => held?.r === r && !held.keys && drop();
    r.el.addEventListener('pointerup', up);
    r.el.addEventListener('pointercancel', up);
    r.el.addEventListener('lostpointercapture', up);

    // Keyboard: pick up, move, drop, cancel.
    r.el.addEventListener('keydown', (e) => {
      const n = order.length;
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        if (held?.r === r) {
          drop();
          said.textContent = `${title(r)} dropped at position ${slotOf(r) + 1} of ${n}.`;
        } else if (!held) {
          lift(r, true);
          said.textContent = `${title(r)} picked up, position ${slotOf(r) + 1} of ${n}. Use the arrow keys to move it.`;
        }
      } else if (held?.r === r && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        e.preventDefault();
        if (moveTo(r, slotOf(r) + (e.key === 'ArrowUp' ? -1 : 1))) said.textContent = `Position ${slotOf(r) + 1} of ${n}.`;
      } else if (held?.r === r && e.key === 'Escape') {
        drop(true);
        said.textContent = `${title(r)} put back at position ${slotOf(r) + 1}.`;
      }
    });
    r.el.addEventListener('blur', () => held?.r === r && held.keys && drop());
  });

  // Take over: rows become placed, the list keeps its height.
  list.style.height = `${rows.length * ROW + 10}px`;
  root.classList.add('live');
  layout();
  rows.forEach((r) => r.y.snap());
  draw();
});
