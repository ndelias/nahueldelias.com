// The design lab's line experiments (the thread and the branch went to the
// homepage, and the tree stays for the lab: src/scripts/lines.ts).
//
//   connector  round 4: a line from Nahuel's photo to whatever is being
//              read, bending to the section or card nearest the middle
//   fan        round 5: the steps side by side, lines fanning from a point
//              above to each title and gathering below into another
import { box, clamp, el, onLayout, pageLayer, reduce } from '../scripts/lines';
export { branch, thread, tree } from '../scripts/lines';

/* ---------- C. The connector ---------- */
export function connector(root: HTMLElement) {
  const photo = root.querySelector<HTMLElement>('[data-photo]');
  if (!photo) return;
  const svg = el('svg', { class: 'lines', 'aria-hidden': 'true' });
  Object.assign(svg.style, { position: 'fixed', inset: '0', width: '100%', height: '100%', pointerEvents: 'none', zIndex: '1' });
  const path = el('path');
  const dot = el('rect', { width: 7, height: 7, class: 'mark on' });
  svg.append(path, dot);
  document.body.append(svg);

  // What can be pointed at: the section labels and the work's frames.
  const targets = () =>
    [...root.querySelectorAll<HTMLElement>('.flow [data-section] h2, .feature .shot, .wc .shot')].filter((t) => t.offsetParent);
  let tx = 0, ty = 0, first = true;

  const frame = () => {
    const wide = innerWidth >= 1024;
    const p = photo.getBoundingClientRect();
    const sx = p.right + 12, sy = p.top + p.height / 2;
    // The one nearest the reading line, a little above the middle.
    const line = innerHeight * 0.42;
    let best: DOMRect | null = null, d = Infinity;
    for (const t of targets()) {
      const r = t.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight) continue;
      const dist = Math.abs(r.top + Math.min(r.height, 120) / 2 - line);
      if (dist < d) (d = dist), (best = r);
    }
    const show = wide && best && p.bottom > 0;
    svg.style.opacity = show ? '1' : '0';
    if (show && best) {
      const gx = best.left - 12, gy = best.top + Math.min(best.height, 120) / 2;
      // Spring-ish: the end eases to its new target.
      const ease = reduce || first ? 1 : 0.16;
      tx += (gx - tx) * ease;
      ty += (gy - ty) * ease;
      first = false;
      const dx = Math.max(40, (tx - sx) * 0.5);
      path.setAttribute('d', `M ${sx} ${sy} C ${sx + dx} ${sy}, ${tx - dx} ${ty}, ${tx} ${ty}`);
      dot.setAttribute('x', String(tx - 3.5));
      dot.setAttribute('y', String(ty - 3.5));
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

/* ---------- Round 5, C. The fan ---------- */
export function fan(root: HTMLElement) {
  const list = root.querySelector<HTMLElement>('.steps.columns');
  if (!list) return;
  const items = [...list.querySelectorAll<HTMLElement>('li')];
  const { svg, size } = pageLayer();
  let outs: SVGPathElement[] = [], backs: SVGPathElement[] = [], dots: SVGRectElement[] = [];
  list.dataset.tree = '';

  const draw = () => {
    size();
    [...outs, ...backs, ...dots].forEach((p) => p.remove());
    outs = []; backs = []; dots = [];
    // Side by side only on a wide screen; stacked, the steps just show.
    if (innerWidth >= 1024) {
      const l = box(list);
      const cx = l.left + l.width / 2;
      const o = { x: cx, y: l.top + 8 }, c = { x: cx, y: l.bottom - 8 };
      const cols = items.map((li) => {
        const b = box(li);
        const t = box(li.querySelector('.no') ?? li);
        const range = document.createRange();
        range.selectNodeContents(li);
        const r = range.getBoundingClientRect();
        return { x: t.left + 4, top: t.top - 10, bottom: r.bottom + scrollY + 10, w: b.width };
      });
      outs = cols.map((k) => el('path', { d: `M ${o.x} ${o.y} C ${o.x} ${o.y + 24}, ${k.x} ${k.top - 24}, ${k.x} ${k.top}` }));
      backs = cols.map((k) => el('path', { d: `M ${k.x} ${k.bottom} C ${k.x} ${k.bottom + 24}, ${c.x} ${c.y - 24}, ${c.x} ${c.y}` }));
      dots = [o, c].map((p) => el('rect', { x: p.x - 3.5, y: p.y - 3.5, width: 7, height: 7, class: 'mark on' }));
      svg.append(...outs, ...backs, ...dots);
      for (const p of [...outs, ...backs]) {
        const len = p.getTotalLength();
        p.dataset.len = String(len);
        p.style.strokeDasharray = `${len}`;
      }
    }
    progress();
  };

  const progress = () => {
    const top = list.getBoundingClientRect().top;
    const out = reduce ? 1 : clamp((innerHeight * 0.9 - top) / (innerHeight * 0.3));
    const back = reduce ? 1 : clamp((innerHeight * 0.6 - top) / (innerHeight * 0.3));
    items.forEach((li, i) => {
      const k = clamp(out * 1.4 - i * 0.08);
      const p = outs[i];
      if (p) p.style.strokeDashoffset = `${Number(p.dataset.len) * (1 - k)}`;
      li.classList.toggle('in', !outs.length || k > 0.9);
      const b = backs[i];
      if (b) b.style.strokeDashoffset = `${Number(b.dataset.len) * (1 - clamp(back * 1.4 - i * 0.08))}`;
    });
    dots[1]?.classList.toggle('on', back >= 1);
  };

  onLayout(draw);
  addEventListener('scroll', progress, { passive: true });
}
