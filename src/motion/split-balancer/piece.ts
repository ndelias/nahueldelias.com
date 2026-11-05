// M06, the split balancer, rebuilt from Sheets' split step. A share is
// clamped to what's left after everyone else on the side (withSplitClamped),
// so the slider's thumb stops dead where the other shares begin and the
// side can never be over 100%: the input can't be put into an error state.
// The donut always draws the Unallocated remainder (its grey track), so the
// circle never claims to be full when it isn't, and the total turns green at
// 100%. Split evenly gives each the same share to the cent and the leftover
// cent to the first (withEvenSplitOnSide).
//
// New here: the donut's slices ride springs to their new lengths and
// places, where Sheets redraws them at once. Reduced motion: at once.

import { define } from '../runtime';
import { Spring, loop } from '../spring';

const round2 = (n: number) => Math.round(n * 100) / 100;
const fmt = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(2).replace(/0$/, '')}%`;

define('split-balancer', (stage, { reduce }) => {
  const root = stage.querySelector<HTMLElement>('[data-balancer]')!;
  const inputs = [...root.querySelectorAll<HTMLInputElement>('[data-party]')];
  const ids = inputs.map((i) => i.dataset.party!);
  const values = new Map(inputs.map((i) => [i.dataset.party!, Number(i.value)]));
  const slices = ids.map((id) => root.querySelector<SVGCircleElement>(`[data-slice="${id}"]`)!);
  const pcts = ids.map((id) => root.querySelector<HTMLElement>(`[data-pct="${id}"]`)!);
  const total = root.querySelector<HTMLElement>('[data-total]')!;
  const left = root.querySelector<HTMLElement>('[data-left]')!;
  // Each slice's length and where it starts, in percent of the ring.
  const len = ids.map((id) => new Spring(values.get(id)!, 180));
  const at = ids.map(() => new Spring(0, 180));

  const draw = () => {
    slices.forEach((c, i) => {
      c.style.strokeDasharray = `${Math.max(0, len[i].value).toFixed(3)} 100`;
      c.style.strokeDashoffset = (-at[i].value).toFixed(3);
    });
  };
  const anim = loop((dt) => {
    let moving = false;
    for (const s of [...len, ...at]) {
      if (s.resting(0.01)) s.snap();
      else {
        s.step(dt);
        moving = true;
      }
    }
    draw();
    return moving;
  });

  const show = () => {
    let start = 0;
    ids.forEach((id, i) => {
      const v = values.get(id)!;
      len[i].target = v;
      at[i].target = start;
      start += v;
      pcts[i].textContent = fmt(v);
      inputs[i].value = String(v);
      inputs[i].setAttribute('aria-valuetext', fmt(v));
    });
    const sum = round2(start);
    total.textContent = String(sum);
    left.textContent = sum >= 100 ? 'Fully allocated' : `${fmt(round2(100 - sum))} unallocated`;
    root.classList.toggle('full', sum >= 100);
    if (reduce) [...len, ...at].forEach((s) => s.snap());
    anim.start();
  };

  // The cap is whatever the others haven't taken.
  const others = (id: string) => ids.reduce((sum, k) => (k === id ? sum : sum + values.get(k)!), 0);
  inputs.forEach((input) =>
    input.addEventListener('input', () => {
      const id = input.dataset.party!;
      values.set(id, round2(Math.max(0, Math.min(100 - others(id), Number(input.value)))));
      show();
    }),
  );
  root.querySelector('[data-even]')!.addEventListener('click', () => {
    const base = Math.floor((100 / ids.length) * 100) / 100;
    const remainder = round2(100 - base * ids.length);
    ids.forEach((id, i) => values.set(id, round2(i === 0 ? base + remainder : base)));
    show();
  });

  // Start from an empty ring, so the first view fills it in.
  if (!reduce) len.forEach((s) => (s.value = 0));
  show();
});
