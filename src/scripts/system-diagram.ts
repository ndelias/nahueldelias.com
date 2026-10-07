// Behaviour for SystemDiagram.astro, compiled on its own and added by
// <AfterLoad> once the page has loaded, so none of it is fetched before the
// first paint.
import type { DiagramSpec, RunStep, Tone } from '../components/diagrams/types';
type Pt = [number, number];
interface Box {
  l: number;
  t: number;
  r: number;
  b: number;
  cx: number;
  cy: number;
}

const SVG = "http://www.w3.org/2000/svg";
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Polyline with rounded corners.
const roundedPath = (pts: Pt[], radius = 8) => {
  const p = pts.filter((pt, i) => i === 0 || pt[0] !== pts[i - 1][0] || pt[1] !== pts[i - 1][1]);
  let d = `M${p[0][0]},${p[0][1]}`;
  for (let i = 1; i < p.length - 1; i++) {
    const [ax, ay] = p[i - 1];
    const [bx, by] = p[i];
    const [cx, cy] = p[i + 1];
    const r = Math.min(radius, Math.hypot(bx - ax, by - ay) / 2, Math.hypot(cx - bx, cy - by) / 2);
    const ux = Math.sign(bx - ax), uy = Math.sign(by - ay);
    const vx = Math.sign(cx - bx), vy = Math.sign(cy - by);
    d += ` L${bx - ux * r},${by - uy * r} Q${bx},${by} ${bx + vx * r},${by + vy * r}`;
  }
  const last = p[p.length - 1];
  return `${d} L${last[0]},${last[1]}`;
};

// Every spec, bundled in (this file loads after the page has), found by
// the id on the diagram's root.
const SPECS = import.meta.glob<Record<string, DiagramSpec>>('../components/diagrams/specs/*.ts', { eager: true });
const loadSpec = (id: string): DiagramSpec | undefined =>
  Object.values(SPECS).flatMap((m) => Object.values(m)).find((s) => s?.id === id);

function initDiagram(root: HTMLElement, spec: DiagramSpec) {
  const stage = root.querySelector<HTMLElement>("[data-sd-stage]")!;
  const svg = root.querySelector<SVGSVGElement>("[data-sd-wires]")!;
  const labels = root.querySelector<HTMLElement>("[data-sd-labels]")!;
  const log = root.querySelector<HTMLOListElement>("[data-sd-log]")!;
  const inspect = root.querySelector<HTMLElement>("[data-sd-inspect]")!;
  const el = (id: string) => root.querySelector<HTMLElement>(`[data-node="${CSS.escape(id)}"]`)!;
  const wires = new Map<string, SVGPathElement>();

  // Boxes relative to the stage, on whole pixels, so the wires land on the
  // same pixels every time (fractional layout would anti-alias them a shade
  // differently from one render to the next).
  const rel = (r: DOMRect): Box => {
    const s = stage.getBoundingClientRect();
    const l = Math.round(r.left - s.left), t = Math.round(r.top - s.top);
    const w = Math.round(r.width), h = Math.round(r.height);
    return { l, t, r: l + w, b: t + h, cx: l + Math.round(w / 2), cy: t + Math.round(h / 2) };
  };
  const boxes = (id: string) => {
    const outer = rel(el(id.split(".")[0]).getBoundingClientRect());
    const self = id.includes(".") ? rel(el(id).getBoundingClientRect()) : outer;
    return { outer, self };
  };
  const topLevel = () => spec.nodes.map((n) => ({ id: n.id, box: rel(el(n.id).getBoundingClientRect()) }));

  function route(from: string, to: string, lane: number): { pts: Pt[]; gutter: boolean } {
    const A = boxes(from), B = boxes(to);
    const stacked = stage.clientWidth < 700;
    const gap = 1;
    // Boxes that share a band get a straight wire through the middle of the overlap.
    const bandY = (a: Box, b: Box) => {
      const lo = Math.max(a.t + 10, b.t + 10), hi = Math.min(a.b - 10, b.b - 10);
      return hi > lo ? (lo + hi) / 2 : null;
    };
    if (!stacked && (B.outer.l >= A.outer.r - gap || B.outer.r <= A.outer.l + gap)) {
      const y = bandY(A.self, B.self);
      const right = B.outer.l >= A.outer.r - gap;
      if (y !== null) return { pts: [[right ? A.outer.r : A.outer.l, y], [right ? B.outer.l : B.outer.r, y]], gutter: false };
    }
    if (!stacked && B.outer.l >= A.outer.r - gap) {
      const s: Pt = [A.outer.r, A.self.cy], e: Pt = [B.outer.l, B.self.cy];
      const mx = (s[0] + e[0]) / 2;
      return { pts: [s, [mx, s[1]], [mx, e[1]], e], gutter: false };
    }
    if (!stacked && B.outer.r <= A.outer.l + gap) {
      const s: Pt = [A.outer.l, A.self.cy], e: Pt = [B.outer.r, B.self.cy];
      const mx = (s[0] + e[0]) / 2;
      return { pts: [s, [mx, s[1]], [mx, e[1]], e], gutter: false };
    }
    const down = B.outer.t >= A.outer.b - gap;
    const s: Pt = [A.self.cx, down ? A.outer.b : A.outer.t];
    const e: Pt = [B.self.cx, down ? B.outer.t : B.outer.b];
    const [y0, y1] = down ? [s[1], e[1]] : [e[1], s[1]];
    const x0 = Math.min(s[0], e[0]) - 2, x1 = Math.max(s[0], e[0]) + 2;
    const parents = [from.split(".")[0], to.split(".")[0]];
    const blocked = topLevel().some(
      (n) => !parents.includes(n.id) && n.box.r > x0 && n.box.l < x1 && n.box.b > y0 + 1 && n.box.t < y1 - 1,
    );
    if (blocked) {
      // Around the right-hand side, one lane per routed wire.
      const right = Math.max(...topLevel().map((n) => n.box.r));
      const x = right + 14 + lane * 10;
      return { pts: [[A.outer.r, A.self.cy], [x, A.self.cy], [x, B.self.cy], [B.outer.r, B.self.cy]], gutter: true };
    }
    const lo = Math.max(A.self.l + 16, B.self.l + 16), hi = Math.min(A.self.r - 16, B.self.r - 16);
    if (hi > lo) {
      const x = (lo + hi) / 2;
      return { pts: [[x, s[1]], [x, e[1]]], gutter: false };
    }
    const my = (s[1] + e[1]) / 2;
    return { pts: [s, [s[0], my], [e[0], my], e], gutter: false };
  }

  function draw() {
    svg.replaceChildren();
    labels.replaceChildren();
    wires.clear();
    let lane = 0;
    const routed = spec.edges.map((edge) => {
      const r = route(edge.from, edge.to, lane);
      if (r.gutter) lane++;
      return { edge, pts: r.pts, gutter: r.gutter };
    });
    // Elbowed wires whose middle segment falls in the same channel get their own lanes.
    const channels = new Map<string, Pt[][]>();
    for (const { pts } of routed) {
      if (pts.length !== 4) continue;
      const vertical = pts[1][0] === pts[2][0];
      const key = vertical ? `v${Math.round(pts[1][0])}` : `h${Math.round(pts[1][1])}`;
      channels.set(key, [...(channels.get(key) ?? []), pts]);
    }
    for (const [key, group] of channels) {
      if (group.length < 2) continue;
      const vertical = key.startsWith("v");
      group.sort((a, b) => (vertical ? Math.min(a[1][1], a[2][1]) - Math.min(b[1][1], b[2][1]) : Math.min(a[1][0], a[2][0]) - Math.min(b[1][0], b[2][0])));
      group.forEach((pts, i) => {
        const off = (i - (group.length - 1) / 2) * 16;
        if (vertical) pts[1][0] = pts[2][0] = pts[1][0] + off;
        else pts[1][1] = pts[2][1] = pts[1][1] + off;
      });
    }
    for (const { edge, pts, gutter } of routed) {
      const tone: Tone = edge.tone ?? "muted";
      const path = document.createElementNS(SVG, "path");
      path.setAttribute("d", roundedPath(pts));
      path.setAttribute("class", `sd-wire tone-${tone}${edge.dashed ? " is-dashed" : ""}`);
      svg.append(path);
      wires.set(`${edge.from}>${edge.to}`, path);

      // Arrowhead along the last segment.
      const [px, py] = pts[pts.length - 2], [ex, ey] = pts[pts.length - 1];
      const ang = Math.atan2(ey - py, ex - px), k = 7;
      const head = document.createElementNS(SVG, "polygon");
      head.setAttribute(
        "points",
        [
          [ex, ey],
          [ex - k * Math.cos(ang - 0.45), ey - k * Math.sin(ang - 0.45)],
          [ex - k * Math.cos(ang + 0.45), ey - k * Math.sin(ang + 0.45)],
        ]
          .map((p) => p.join(","))
          .join(" "),
      );
      head.setAttribute("class", `sd-head-mark tone-${tone}`);
      svg.append(head);

      // Gutter wires (narrow layout) skip their label: it would sit off the edge.
      if (edge.label && !gutter) {
        // Centre of the longest segment: the open stretch between boxes.
        let best = 0, mid: Pt = pts[0], flat = false;
        for (let i = 1; i < pts.length; i++) {
          const len = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
          if (len > best) {
            best = len;
            mid = [(pts[i][0] + pts[i - 1][0]) / 2, (pts[i][1] + pts[i - 1][1]) / 2];
            flat = pts[i][1] === pts[i - 1][1];
          }
        }
        const tag = document.createElement("span");
        tag.textContent = edge.label;
        tag.style.left = `${mid[0]}px`;
        tag.style.top = `${mid[1]}px`;
        labels.append(tag);
        // A label wider than its horizontal run sits just above the line instead of on it.
        if (flat && tag.offsetWidth > best - 12) tag.style.top = `${mid[1] - tag.offsetHeight / 2 - 6}px`;
      }
    }
  }

  // Inspector: hover, focus or tap any box or sub-step. Its text is the
  // spec's: a step shows its own detail, or its box's.
  const about = (id: string) => {
    const [nodeId, stepId] = id.split(".");
    const node = spec.nodes.find((n) => n.id === nodeId);
    const step = stepId ? node?.steps?.find((s) => s.id === stepId) : undefined;
    return { title: step ? `${node?.title} · ${step.label}` : (node?.title ?? ""), detail: step?.detail ?? node?.detail ?? "" };
  };
  const show = (target: HTMLElement) => {
    const { title, detail } = about(target.dataset.node!);
    inspect.querySelector(".sd-inspect-title")!.textContent = title;
    inspect.querySelector(".sd-inspect-body")!.textContent = detail;
  };
  for (const t of root.querySelectorAll<HTMLElement>("[data-node]")) {
    const handler = (ev: Event) => {
      ev.stopPropagation();
      show(t);
    };
    t.addEventListener("pointerenter", handler);
    t.addEventListener("focus", handler);
    t.addEventListener("click", handler);
  }

  // Runs.
  let token = 0;
  const clearMarks = () => {
    for (const n of root.querySelectorAll(".is-active, .is-done")) n.classList.remove("is-active", "is-done");
    root.classList.remove("is-running");
  };
  const pulse = async (path: SVGPathElement, ms: number) => {
    if (reduced) return;
    const dot = document.createElementNS(SVG, "circle");
    dot.setAttribute("r", "4");
    dot.setAttribute("class", "sd-pulse");
    svg.append(dot);
    const len = path.getTotalLength(), t0 = performance.now();
    await new Promise<void>((resolve) => {
      const tick = (now: number) => {
        const k = Math.min(1, (now - t0) / ms);
        const p = path.getPointAtLength(len * (1 - Math.pow(1 - k, 2)));
        dot.setAttribute("cx", String(p.x));
        dot.setAttribute("cy", String(p.y));
        if (k < 1) requestAnimationFrame(tick);
        else resolve();
      };
      requestAnimationFrame(tick);
    });
    dot.remove();
  };
  const writeLog = (step: RunStep, t: number) => {
    const li = document.createElement("li");
    if (step.tone) li.classList.add(`tone-${step.tone}`);
    const text = document.createElement("span");
    text.textContent = step.log;
    const time = document.createElement("time");
    time.textContent = `+${(t / 1000).toFixed(1)}s`;
    li.append(text, time);
    log.append(li);
    // The newest line in view when the log scrolls (beside a wide diagram).
    log.scrollTop = log.scrollHeight;
  };

  async function play(key: string) {
    const my = ++token;
    clearMarks();
    log.replaceChildren();
    root.classList.add("is-running");
    let t = 0;
    for (const step of spec.runs[key].steps) {
      if (my !== token) return;
      for (const n of root.querySelectorAll(".is-active")) {
        n.classList.remove("is-active");
        n.classList.add("is-done");
      }
      const travel = reduced ? 0 : 600;
      await Promise.all((step.edges ?? []).map(([a, b]) => wires.get(`${a}>${b}`)).filter(Boolean).map((p) => pulse(p!, travel)));
      if (my !== token) return;
      for (const id of step.nodes ?? []) el(id)?.classList.add("is-active");
      const hold = step.ms ?? 900;
      t += travel + hold;
      writeLog(step, t);
      await wait(reduced ? 350 : hold);
    }
    if (my !== token) return;
    for (const n of root.querySelectorAll(".is-active")) {
      n.classList.remove("is-active");
      n.classList.add("is-done");
    }
  }
  for (const btn of root.querySelectorAll<HTMLButtonElement>("[data-run]")) btn.addEventListener("click", () => play(btn.dataset.run!));
  root.querySelector("[data-reset]")!.addEventListener("click", () => {
    token++;
    clearMarks();
    log.innerHTML = '<li class="sd-log-idle">ready · press run, or hover any part of the system</li>';
  });

  draw();
  new ResizeObserver(() => draw()).observe(stage);
  document.fonts?.ready.then(draw);
}

function init(scope: ParentNode = document) {
  for (const root of scope.querySelectorAll<HTMLElement>('[data-sd]')) {
    if (root.dataset.bound) continue;
    root.dataset.bound = '';
    const spec = loadSpec(root.dataset.sd!);
    if (spec) initDiagram(root, spec);
  }
}

init();

// A tab swaps in new content (Tabs.astro): set up the diagram in it.
document.addEventListener('tabs:swap', (event) => init((event as CustomEvent<HTMLElement>).detail));
