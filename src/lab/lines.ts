// Round 4 of the design lab: three ways the old homepage's lines could come
// back on the new one (src/components/home/SplitLead.astro, marked
// data-lines). Each draws in the page's ink, a hairline at half strength, as
// the old thread did.
//
//   thread     one line down the gutter between his column and the work,
//              drawing as you scroll, a mark at each section, ending in an
//              arrow at the meadow's path
//   tree       in About me, lines branch out of one point to each step and
//              come back together, as the section scrolls in
//   connector  a line from his photo to whatever is being read, bending to
//              the section or card nearest the middle of the screen
//
// Under reduced motion each is drawn whole, and the connector moves without
// easing.

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const SVG = 'http://www.w3.org/2000/svg';
const clamp = (v: number) => Math.min(1, Math.max(0, v));

function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}) {
  const e = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  return e;
}

/** An SVG over the whole document (page coordinates). */
function pageLayer() {
  const svg = el('svg', { class: 'lab-lines', 'aria-hidden': 'true' });
  Object.assign(svg.style, { position: 'absolute', left: '0', top: '0', width: '100%', overflow: 'visible', pointerEvents: 'none' });
  document.body.append(svg);
  const size = () => (svg.style.height = `${document.documentElement.scrollHeight}px`);
  size();
  return { svg, size };
}

/** A rect in page coordinates. */
const box = (e: Element) => {
  const r = e.getBoundingClientRect();
  return { left: r.left + scrollX, right: r.right + scrollX, top: r.top + scrollY, bottom: r.bottom + scrollY, width: r.width, height: r.height };
};

/** Redraw on layout changes: resizes, fonts, images arriving. */
function onLayout(draw: () => void) {
  let raf = 0;
  const again = () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(draw);
  };
  new ResizeObserver(again).observe(document.body);
  document.fonts.ready.then(again);
  addEventListener('load', again);
  again();
}

/* ---------- A. The thread ---------- */
export function thread(root: HTMLElement) {
  const side = root.querySelector('.side')!;
  const flow = root.querySelector('.flow')!;
  const meadow = document.querySelector('[data-meadow]');
  const { svg, size } = pageLayer();
  const line = el('path');
  const head = el('polyline');
  svg.append(line, head);
  let marks: SVGRectElement[] = [];
  let startY = 0, endY = 0, length = 0;

  const draw = () => {
    size();
    const wide = innerWidth >= 1024;
    const s = box(side), f = box(flow);
    const x = Math.round(wide ? (s.right + f.left) / 2 : f.left - 8);
    // A mark at each section's label, in the order they're shown.
    const labels = [...flow.querySelectorAll<HTMLElement>('[data-section]')]
      .filter((p) => p.offsetParent)
      .map((p) => p.querySelector('h2'))
      .filter((h): h is HTMLHeadingElement => !!h)
      .map((h) => Math.round(box(h).top + h.getBoundingClientRect().height / 2))
      .sort((a, b) => a - b);
    startY = labels[0] ?? f.top;
    // The end: down past the work, then a curve into the meadow's path,
    // which climbs from the bottom middle of the scene into its hills.
    const m = meadow ? box(meadow) : { left: 0, width: innerWidth, top: f.bottom + 80, height: 300 };
    const px = Math.round(m.left + m.width * 0.55);
    endY = Math.round(m.top + m.height * 0.52);
    const bend = Math.round(m.top + m.height * 0.12);
    line.setAttribute('d', `M ${x} ${startY} V ${bend} C ${x} ${bend + 90}, ${px} ${endY - 120}, ${px} ${endY - 10}`);
    head.setAttribute('points', `${px - 5},${endY - 16} ${px},${endY - 10} ${px + 5},${endY - 16}`);
    length = line.getTotalLength();
    line.style.strokeDasharray = `${length}`;
    marks.forEach((r) => r.remove());
    marks = labels.map((y) => {
      const r = el('rect', { x: x - 3.5, y: y - 3.5, width: 7, height: 7, class: 'mark' });
      r.dataset.y = String(y);
      svg.append(r);
      return r;
    });
    progress();
  };

  const progress = () => {
    const atEnd = innerHeight + scrollY >= document.documentElement.scrollHeight - 4;
    const reached = reduce || atEnd ? Infinity : scrollY + innerHeight * 0.75;
    const k = clamp((reached - startY) / (endY - startY));
    line.style.strokeDashoffset = `${length * (1 - k)}`;
    head.style.opacity = k > 0.985 ? '1' : '0';
    for (const r of marks) r.classList.toggle('on', reached >= Number(r.dataset.y));
  };

  onLayout(draw);
  addEventListener('scroll', progress, { passive: true });
}

/* ---------- B. The tree ---------- */
export function tree(root: HTMLElement) {
  const list = root.querySelector<HTMLElement>('.short');
  if (!list) return;
  const items = [...list.querySelectorAll<HTMLElement>('li')];
  const { svg, size } = pageLayer();
  let outs: SVGPathElement[] = [], backs: SVGPathElement[] = [], dots: SVGRectElement[] = [];
  list.dataset.tree = '';

  const draw = () => {
    size();
    [...outs, ...backs, ...dots].forEach((p) => p.remove());
    const l = box(list);
    // Each step's own text, start to end.
    const spans = items.map((li) => {
      const range = document.createRange();
      range.selectNodeContents(li);
      const r = range.getBoundingClientRect();
      return { left: r.left + scrollX, right: r.right + scrollX, y: r.top + scrollY + r.height / 2 };
    });
    const mid = (spans[0].y + spans[spans.length - 1].y) / 2;
    const maxRight = Math.max(...spans.map((s) => s.right));
    // On a phone there's no room on the left: only the lines coming back
    // together are drawn, on the right.
    const room = l.left - 64 >= 8;
    const o = { x: l.left - 64, y: mid };
    const c = { x: Math.min(maxRight + 64, document.documentElement.clientWidth - 12), y: mid };
    outs = room ? spans.map((s) => el('path', { d: `M ${o.x} ${o.y} C ${o.x + 40} ${o.y}, ${s.left - 44} ${s.y}, ${s.left - 12} ${s.y}` })) : [];
    // Straight until past the longest step, then into the point: no line
    // crosses another step's words.
    const clear = maxRight + 12;
    const bend = Math.max(12, (c.x - clear) * 0.6);
    backs = spans.map((s) => el('path', { d: `M ${s.right + 12} ${s.y} H ${clear} C ${clear + bend} ${s.y}, ${c.x - bend} ${c.y}, ${c.x} ${c.y}` }));
    dots = (room ? [o, c] : [c]).map((p) => el('rect', { x: p.x - 3.5, y: p.y - 3.5, width: 7, height: 7, class: 'mark on' }));
    svg.append(...outs, ...backs, ...dots);
    for (const p of [...outs, ...backs]) {
      const len = p.getTotalLength();
      p.dataset.len = String(len);
      p.style.strokeDasharray = `${len}`;
    }
    progress();
  };

  const progress = () => {
    const top = list.getBoundingClientRect().top;
    const out = reduce ? 1 : clamp((innerHeight * 0.9 - top) / (innerHeight * 0.35));
    const back = reduce ? 1 : clamp((innerHeight * 0.75 - top) / (innerHeight * 0.35));
    outs.forEach((p, i) => {
      // One after another, top to bottom.
      const k = clamp(out * 1.6 - i * 0.15);
      p.style.strokeDashoffset = `${Number(p.dataset.len) * (1 - k)}`;
      items[i].classList.toggle('in', k > 0.9);
    });
    backs.forEach((p, i) => {
      const k = clamp(back * 1.6 - i * 0.15);
      p.style.strokeDashoffset = `${Number(p.dataset.len) * (1 - k)}`;
      if (!outs.length) items[i].classList.toggle('in', k > 0.9);
    });
    if (outs.length) dots[0]?.classList.toggle('on', out > 0);
    dots[dots.length - 1]?.classList.toggle('on', back >= 1);
  };

  onLayout(draw);
  addEventListener('scroll', progress, { passive: true });
}

/* ---------- C. The connector ---------- */
export function connector(root: HTMLElement) {
  const photo = root.querySelector<HTMLElement>('[data-photo]');
  if (!photo) return;
  const svg = el('svg', { class: 'lab-lines', 'aria-hidden': 'true' });
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
