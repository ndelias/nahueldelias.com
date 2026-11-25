// The homepage's lines, from the old homepage (chosen in the design lab,
// round 4): the thread, one line down the gutter between Nahuel's column
// and the work, drawing as you scroll, a mark at every section heading, and
// ending in an arrow at the meadow's path; and the tree, About me's five
// steps, lines branching out of one point to each and coming back together
// as the section scrolls in. A hairline in the page's ink at half strength,
// as the old thread was. Under reduced motion both are drawn whole.

export const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const SVG = 'http://www.w3.org/2000/svg';
export const clamp = (v: number) => Math.min(1, Math.max(0, v));

export function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}) {
  const e = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  return e;
}

/** An SVG over the whole document (page coordinates). */
function pageLayer() {
  const svg = el('svg', { class: 'lines', 'aria-hidden': 'true' });
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
    // A mark at every heading in the flow, in the order they're shown:
    // each section, and Experience's Education and Leadership.
    const labels = [...flow.querySelectorAll<HTMLElement>('[data-section] h2, [data-section] h3.label')]
      .filter((h) => h.offsetParent)
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
  const list = root.querySelector<HTMLElement>('.steps');
  if (!list) return;
  const items = [...list.querySelectorAll<HTMLElement>('li')];
  const { svg, size } = pageLayer();
  let outs: SVGPathElement[] = [], backs: SVGPathElement[] = [], dots: SVGRectElement[] = [];
  list.dataset.tree = '';

  const draw = () => {
    size();
    [...outs, ...backs, ...dots].forEach((p) => p.remove());
    const l = box(list);
    // Each step from its number to the end of its longest line, the lines
    // meeting it at its title.
    const spans = items.map((li) => {
      const range = document.createRange();
      range.selectNodeContents(li);
      const r = range.getBoundingClientRect();
      const t = (li.querySelector('.step-title') ?? li).getBoundingClientRect();
      return { left: r.left + scrollX, right: r.right + scrollX, y: t.top + scrollY + t.height / 2 };
    });
    const mid = (spans[0].y + spans[spans.length - 1].y) / 2;
    const maxRight = Math.max(...spans.map((s) => s.right));
    // On a phone there's no room on the left: only the lines coming back
    // together are drawn, on the right.
    // On a wide screen the branches start on the thread, in the middle of
    // the gutter, so the thread splits into the tree.
    const room = l.left - 32 >= 8;
    const o = { x: l.left - 32, y: mid };
    const c = { x: Math.min(maxRight + 64, document.documentElement.clientWidth - 12), y: mid };
    outs = room ? spans.map((s) => el('path', { d: `M ${o.x} ${o.y} C ${o.x + 24} ${o.y}, ${s.left - 28} ${s.y}, ${s.left - 10} ${s.y}` })) : [];
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
