// Round 4 of the design lab: the connector, a line from Nahuel's photo to
// whatever is being read, bending to the section or card nearest the middle
// of the screen. (The thread and the tree went to the homepage:
// src/scripts/lines.ts.)
import { el, reduce } from '../scripts/lines';
export { thread, tree } from '../scripts/lines';

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
