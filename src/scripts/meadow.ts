// The pixel meadow: a landscape from a fixed seed, drawn small and scaled
// up square. It opened the old homepage; it now closes the new one, as its
// footer (anchor 'bottom').

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- The meadow ----------
   A pixel landscape generated from a fixed seed, so it's the same every
   visit, drawn small and scaled up square. Built back to front, each layer
   its own small canvas: sky and clouds, mountains, a tree line, rolling
   hills with trees, the meadow with a path into the hills, then bushes
   along the bottom and a tree's canopy hanging in from the top left. Static
   layers are painted once; each frame only composes them: clouds drift, the
   canopy's lower leaves sway, cows graze and wander, birds pass. Scrolling
   moves the layers at different speeds (depth). The loop runs only while
   the meadow is on screen; under reduced motion it's one still frame. */
export function meadow(canvas: HTMLCanvasElement, anchor: 'top' | 'bottom' = 'top') {
  const g = canvas.getContext('2d')!;
  const PX = 4; // screen px per scene pixel
  const SEED = 11;

  const hash = (x: number, y: number) => {
    let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(SEED, 144665);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  };
  const noise = (x: number, y: number) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
  const fbm = (x: number, y: number, o = 4) => {
    let s = 0, a = 0.5, f = 1, n = 0;
    for (let i = 0; i < o; i++) { s += a * noise(x * f, y * f); n += a; f *= 2; a *= 0.5; }
    return s / n;
  };
  let r0 = SEED;
  const rnd = () => (r0 = (Math.imul(r0, 16807) >>> 0) % 2147483647) / 2147483647;

  type RGB = [number, number, number];
  const rgb = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const pal = (...h: string[]) => h.map(rgb);
  const P = {
    sky: pal('#F2F1ED', '#ECEEEA', '#E3EAEA', '#D9E5E8'),
    cloud: pal('#FFFFFF', '#F1F4F4', '#DCE3E6', '#C3CED5'),
    mtn: pal('#B9C6CF', '#A3B3C0', '#8EA0B0'),
    line: pal('#4F8A6E', '#3E765D', '#2F604C'),
    hill: pal('#B9CB5C', '#A3BB4C', '#8BA63F', '#728E34'),
    meadow: pal('#93CC4F', '#82BF44', '#70B03A', '#5E9C32', '#4C8429'),
    dirt: pal('#C9AE7C', '#B59868', '#9C8257'),
    leaf: pal('#173B2A', '#22523A', '#2F6B44', '#4A8E43', '#73B24A', '#A3CF5C'),
    bark: pal('#2E2318', '#46362A'),
    flower: pal('#F6F0D6', '#F0D662'),
  };
  const pick = (p: RGB[], v: number) => p[Math.max(0, Math.min(p.length - 1, Math.floor(v * p.length)))];

  type Layer = { c: OffscreenCanvas; h: number; set: (x: number, y: number, col: RGB) => void; done: () => Layer };
  const layer = (w: number, h: number): Layer => {
    const c = new OffscreenCanvas(w, h);
    const x = c.getContext('2d')!;
    const img = x.createImageData(w, h);
    const self: Layer = {
      c, h,
      set(px, py, col) {
        px |= 0; py |= 0;
        if (px < 0 || py < 0 || px >= w || py >= h) return;
        const i = (py * w + px) * 4;
        img.data[i] = col[0]; img.data[i + 1] = col[1]; img.data[i + 2] = col[2]; img.data[i + 3] = 255;
      },
      done() { x.putImageData(img, 0, 0); return self; },
    };
    return self;
  };

  const EXTRA = 24; // rows past the frame, room for the parallax
  let PW = 0, PH = 0, HOR = 0, MEAD = 0;
  let sky: Layer, clouds: Layer, land: Layer, bush: Layer, can: Layer, landTop = 0, bushTop = 0;
  type Cow = { x: number; y: number; big: boolean; dir: number; graze: boolean; t: number; walk: number; white: boolean };
  let cows: Cow[] = [];

  function build() {
    const r = canvas.getBoundingClientRect();
    PW = Math.ceil(r.width / PX); PH = Math.ceil(r.height / PX);
    canvas.width = PW; canvas.height = PH;
    g.imageSmoothingEnabled = false;
    r0 = SEED;
    HOR = Math.round(PH * 0.44); // foot of the mountains
    MEAD = Math.round(PH * 0.56); // where the meadow starts

    // Sky: a few flat bands, page color at the top.
    sky = layer(PW, HOR + EXTRA);
    for (let y = 0; y < sky.h; y++) {
      const k = Math.max(0, (y - EXTRA) / HOR);
      for (let x = 0; x < PW; x++) sky.set(x, y, pick(P.sky, Math.min(0.99, k * 1.05 + (hash(x, y) - 0.5) * 0.06)));
    }
    sky.done();

    // Clouds: a strip twice the width, scrolled and wrapped; lit from above,
    // the top of each bright, the underside shaded.
    const CW = PW * 2, CH = Math.round(HOR * 0.85);
    clouds = layer(CW, CH);
    const cv = (x: number, y: number) => {
      const wrap = ((x % CW) + CW) % CW, k = wrap / CW;
      const n = fbm(wrap / 20, y / 13, 5) * (1 - k) + fbm((wrap - CW) / 20, y / 13, 5) * k;
      return n * (Math.sin((y / CH) * Math.PI) * 0.9 + 0.1);
    };
    for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) {
      const v = cv(x, y);
      if (v < 0.42) continue;
      const below = cv(x, y + 2), above = cv(x, y - 2);
      let shade = v > 0.55 ? 1 : 2;
      if (above < 0.42) shade = 0;
      else if (below < 0.42) shade = 3;
      else if (below > v + 0.02) shade = Math.min(3, shade + 1);
      clouds.set(x, y, P.cloud[shade]);
    }
    clouds.done();

    // The land, back to front, on one canvas (row 0 = scene row HOR - oy).
    const oy = Math.round(PH * 0.2);
    land = layer(PW, PH - HOR + oy + EXTRA);
    landTop = HOR - oy;
    const at = (x: number, y: number, col: RGB) => land.set(x, y - landTop, col);
    // Mountains: peaks from squared noise, lit from the left by the trend of
    // the ridge, misty at their foot.
    const mtn: number[] = [];
    for (let x = 0; x < PW + 6; x++) mtn.push(Math.round(HOR - PH * 0.02 - Math.pow(fbm(x / 38, 3.3, 5), 2.2) * PH * 0.36));
    for (let x = 0; x < PW; x++) {
      const slope = mtn[Math.max(0, x - 5)] - mtn[x + 5];
      for (let y = mtn[x]; y < HOR + 4; y++) {
        const depth = (y - mtn[x]) / Math.max(1, HOR - mtn[x]) + fbm(x / 6, y / 4, 2) * 0.25;
        at(x, y, P.mtn[depth > 0.8 || slope > 1 ? 0 : slope < -2 && depth < 0.55 ? 2 : 1]);
      }
    }
    // A tree line of round crowns.
    for (let x = -4; x < PW + 4; x += 2 + Math.floor(rnd() * 3)) {
      const rr = 2 + rnd() * 2.5, cy = HOR + 2 - rr * 0.6 - fbm(x / 30, 9) * 4;
      for (let dy = -rr; dy <= rr; dy++) for (let dx = -rr; dx <= rr; dx++) {
        if (dx * dx + dy * dy > rr * rr) continue;
        at(x + dx, cy + dy, P.line[dx + dy < -rr * 0.5 ? 0 : dx + dy > rr * 0.4 ? 2 : 1]);
      }
    }
    for (let x = 0; x < PW; x++) for (let y = HOR + 1; y < HOR + 5; y++) at(x, y, P.line[2]);
    // Rolling hills, two bands, in patches.
    [HOR + 3, HOR + Math.round((MEAD - HOR) * 0.55)].forEach((base, i) => {
      for (let x = 0; x < PW; x++) {
        const top = Math.round(base - Math.sin(x / (40 + i * 25) + i * 2) * 4 - fbm(x / 45, i * 7) * 7);
        for (let y = top; y < MEAD + 6; y++) at(x, y, pick(P.hill, y - top < 1 ? 0.1 : fbm(x / 9, y / 5 + i * 10, 3) * 0.9 + 0.12 + (i ? 0 : 0.15)));
      }
    });
    // Round trees on the hills, bigger nearer.
    for (let i = 0; i < 26; i++) {
      const x = rnd() * PW, y = HOR + 6 + rnd() * (MEAD - HOR - 4), rr = 1.6 + rnd() * 2.6 * ((y - HOR) / (MEAD - HOR) + 0.4);
      for (let ty = 0; ty < rr * 0.8; ty++) at(x, y - ty, P.bark[0]);
      for (let dy = -rr; dy <= rr; dy++) for (let dx = -rr; dx <= rr; dx++) {
        if (dx * dx + dy * dy > rr * rr) continue;
        const k = (dx + dy) / (rr * 2) + 0.5;
        at(x + dx, y - rr - 1 + dy, P.leaf[k < 0.35 ? 4 : k < 0.7 ? 3 : 2]);
      }
    }
    // The meadow: patches, darker toward us; tufts and a few flowers.
    for (let y = MEAD; y < PH + EXTRA; y++) {
      const k = (y - MEAD) / (PH - MEAD);
      for (let x = 0; x < PW; x++) at(x, y, pick(P.meadow, fbm(x / 14, y / 6, 4) * 0.75 + k * 0.25));
    }
    for (let i = 0; i < PW * PH * 0.05; i++) {
      const x = Math.floor(rnd() * PW), y = MEAD + Math.floor(rnd() * (PH - MEAD + EXTRA));
      if (rnd() < 0.04) { at(x, y, P.flower[rnd() < 0.5 ? 0 : 1]); continue; }
      at(x, y, P.meadow[4]);
      if ((y - MEAD) / (PH - MEAD) > 0.4 && rnd() < 0.5) at(x, y - 1, P.meadow[3]);
    }
    // The path: from the bottom, winding up into the hills, narrowing.
    for (let y = HOR + 10; y < PH + EXTRA; y++) {
      const k = Math.max(0, (y - (HOR + 10)) / (PH - HOR - 10));
      const cx = PW * 0.52 + Math.sin(k * 3.2 + 0.6) * PW * 0.09 * k + (1 - k) * PW * 0.03;
      const half = 0.6 + k * k * PW * 0.06;
      for (let x = cx - half; x <= cx + half; x++) at(x, y, Math.abs(x - cx) > half - 1 ? P.dirt[2] : pick(P.dirt, fbm(x / 4, y / 2, 2) * 0.8));
    }
    land.done();

    // Bushes along the bottom, thicker at the corners, open in the middle.
    const bh = Math.round(PH * 0.34);
    bush = layer(PW, bh + EXTRA);
    bushTop = PH - bh;
    for (let y = 0; y < bush.h; y++) for (let x = 0; x < PW; x++) {
      const reach = 0.95 - (Math.min(x, PW - x) / PW) * 1.7, yy = y / bh;
      if (1 - yy > reach * 0.9 + (fbm(x / 7, y / 5, 4) - 0.5) * 0.5) continue;
      bush.set(x, y, P.leaf[Math.max(0, Math.min(5, Math.floor(fbm(x / 3.5, y / 3.5, 3) * 4.5 - yy * 1.5 + 0.4)))]);
    }
    bush.done();

    // The canopy: a trunk down the left edge, behind the leaves; the crown
    // and a fringe of leaves along the top, thinning to the right.
    can = layer(PW, Math.round(PH * 0.86));
    for (let y = Math.round(PH * 0.2); y < can.h; y++) {
      const w = 4 + (y / can.h) * 3;
      for (let x = 0; x < w; x++) can.set(x, y, P.bark[x > w - 2 ? 1 : 0]);
    }
    for (let y = 0; y < can.h; y++) for (let x = 0; x < PW; x++) {
      const ex = x / (PW * 0.42), ey = y / (PH * 0.38);
      const m = Math.min(ex * ex * 0.9 + ey * ey, y / (PH * 0.11) + Math.pow(x / (PW * 0.78), 2) * 0.8);
      if (m > 0.78 + (fbm(x / 6, y / 5, 4) - 0.5) * 0.9) continue;
      const lit = fbm(x / 3, y / 3, 3) - ey * 0.25 - (1 - ex) * 0.1;
      can.set(x, y, P.leaf[Math.max(0, Math.min(5, Math.floor(lit * 5.2 - 0.6)))]);
    }
    can.done();

    cows = [[0.12, 0.66], [0.3, 0.6], [0.66, 0.62], [0.78, 0.7], [0.45, 0.78], [0.22, 0.86], [0.84, 0.6]].map(([fx, fy]) => ({
      x: fx * PW, y: fy * PH, big: fy > 0.7, dir: rnd() < 0.5 ? 1 : -1, graze: rnd() < 0.6, t: rnd() * 6, walk: 0, white: rnd() < 0.3,
    }));
  }

  // Cows, facing right: B body, W patch.
  const COW = {
    big: {
      up: ['..........B.B', '.BBBBBBBB.BBB', 'BBBBWWBBBBBBB', 'BBBBWWBBBBBB.', 'BBBBBBBBB....', '.BB.....BB...', '.B.B....B.B..', '.B.B....B.B..'],
      down: ['.............', '.BBBBBBBBB...', 'BBBBWWBBBBB..', 'BBBBWWBBBBBB.', 'BBBBBBBBBBBBB', '.BB.....BB.BB', '.B.B....B.BB.', '.B.B....B.B..'],
    },
    small: {
      up: ['.....B.B', 'BBBBBBBB', 'BBWBBB..', 'B.B.B...'],
      down: ['........', 'BBBBBB..', 'BBWBBBBB', 'B.B.B.BB'],
    },
  };
  type Bird = { x: number; y: number; vx: number; ph: number };
  const birds: Bird[] = [];
  let nextBird = 2;

  function frame(t: number, dt: number) {
    // How far the page is from the scene's resting place: scrolled down from
    // the top (a meadow that opens the page), or still short of the meadow's
    // bottom edge (a footer, at rest when the page ends).
    const sy = (anchor === 'top' ? scrollY : Math.max(0, canvas.getBoundingClientRect().bottom - innerHeight)) / PX;
    g.clearRect(0, 0, PW, PH);
    // Sky and clouds move least on scroll; the canopy most.
    g.drawImage(sky.c, 0, Math.round(-EXTRA + sy * 0.35));
    const cx = Math.round(-(t * 1.6) % (PW * 2)), cy = Math.round(2 + sy * 0.3);
    g.drawImage(clouds.c, cx, cy);
    g.drawImage(clouds.c, cx + PW * 2, cy);

    // Birds, behind the land, a small flock now and then.
    if (!reduce) {
      nextBird -= dt;
      if (nextBird <= 0) {
        const dir = rnd() < 0.5 ? 1 : -1, n = 1 + Math.floor(rnd() * 4), y = HOR * (0.2 + rnd() * 0.5);
        for (let i = 0; i < n; i++) birds.push({ x: dir > 0 ? -6 - i * 6 : PW + 6 + i * 6, y: y + (i % 2) * 3 + i, vx: dir * (10 + rnd() * 4), ph: rnd() * 6 });
        nextBird = 5 + rnd() * 6;
      }
      for (let i = birds.length - 1; i >= 0; i--) {
        const b = birds[i];
        b.x += b.vx * dt; b.ph += dt * 9;
        if (b.x < -30 || b.x > PW + 30) birds.splice(i, 1);
      }
    }
    g.fillStyle = 'rgb(58,62,68)';
    for (const b of birds) {
      const up = Math.sin(b.ph) > 0, by = Math.round(b.y + Math.sin(b.ph * 0.3) * 1.5 + sy * 0.3), bx = Math.round(b.x);
      g.fillRect(bx, by, 1, 1);
      g.fillRect(bx - 1, by + (up ? -1 : 0), 1, 1); g.fillRect(bx + 1, by + (up ? -1 : 0), 1, 1);
      g.fillRect(bx - 2, by + (up ? -2 : 1), 1, 1); g.fillRect(bx + 2, by + (up ? -2 : 1), 1, 1);
    }

    const landShift = sy * 0.15;
    g.drawImage(land.c, 0, Math.round(landTop + landShift));

    // Cows: graze a while, look up, sometimes walk a few steps.
    cows.sort((a, b) => a.y - b.y);
    for (const c of cows) {
      if (!reduce) {
        c.t -= dt;
        if (c.t <= 0) {
          const r = rnd();
          if (r < 0.2) { c.walk = 1.5 + rnd() * 2; c.graze = false; if (rnd() < 0.3) c.dir *= -1; }
          else c.graze = r < 0.75;
          c.t = 2 + rnd() * 4;
        }
        if (c.walk > 0) { c.walk -= dt; c.x = Math.max(4, Math.min(PW - 16, c.x + c.dir * 2.2 * dt)); }
      }
      const spr = COW[c.big ? 'big' : 'small'][c.graze && c.walk <= 0 ? 'down' : 'up'];
      const w = spr[0].length, h = spr.length;
      const bx = Math.round(c.x), by = Math.round(c.y - h + landShift);
      const step = c.walk > 0 && Math.floor(t * 6) % 2;
      g.fillStyle = 'rgba(40,70,25,0.35)';
      g.fillRect(bx + 1, by + h, w - 2, 1);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const ch = spr[y][c.dir > 0 ? x : w - 1 - x];
        if (ch === '.' || (step && y === h - 1)) continue;
        g.fillStyle = ch === 'W' ? (c.white ? '#F4F1EA' : '#5A514A') : '#2A2826';
        g.fillRect(bx + x, by + y, 1, 1);
      }
    }

    g.drawImage(bush.c, 0, Math.round(bushTop - sy * 0.1));
    // The canopy, its lower rows swaying a pixel in the wind. It hangs from
    // the top of the page, so a footer meadow goes without it.
    if (anchor === 'top') for (let y = 0; y < can.h; y += 3) {
      const amp = Math.max(0, y / can.h - 0.25) * 1.6;
      const off = reduce ? 0 : Math.round(Math.sin(t * 0.9 + y * 0.09) * amp);
      g.drawImage(can.c, 0, y, PW, 3, off, Math.round(y - sy * 0.25), PW, 3);
    }
  }

  let then = performance.now(), start = then, visible = false, running = false;
  const tick = (now: number) => {
    const dt = Math.min(0.1, Math.max(0, now - then) / 1000);
    then = now;
    frame((now - start) / 1000, dt);
    if (!reduce && visible) requestAnimationFrame(tick);
    else running = false;
  };
  const go = () => {
    if (running) return;
    running = true;
    then = performance.now();
    requestAnimationFrame(tick);
  };
  // The arrival: the first frame's pixels fly in from scattered points and
  // settle into the scene, the middle first, then the edges, each pixel on
  // its own short ease (about 1.5s in all). Only then does the scene move.
  // Pixels not yet launched aren't drawn, so the scene fills in as they
  // land. Under reduced motion the scene is simply there.
  function assemble(done: () => void) {
    const W = PW, H = PH, N = W * H;
    const src = new Uint32Array(g.getImageData(0, 0, W, H).data.buffer.slice(0));
    const sx = new Float32Array(N), sy = new Float32Array(N), delay = new Float32Array(N);
    const cx = W / 2, cy = H / 2, far = Math.hypot(cx, cy);
    for (let i = 0; i < N; i++) {
      const x = i % W, y = (i / W) | 0;
      sx[i] = Math.random() * W;
      sy[i] = Math.random() * H;
      delay[i] = Math.random() * 0.3 + (Math.hypot(x - cx, y - cy) / far) * 0.3;
    }
    const DUR = 0.9;
    const out = g.createImageData(W, H), buf = new Uint32Array(out.data.buffer);
    const t0 = performance.now();
    const step = (now: number) => {
      if (canvas.width !== W || canvas.height !== H) return done(); // resized: skip ahead
      const t = (now - t0) / 1000;
      buf.fill(0);
      let landed = true;
      for (let i = 0; i < N; i++) {
        const k = (t - delay[i]) / DUR;
        if (k < 1) landed = false;
        if (k <= 0) continue;
        const e = k >= 1 ? 1 : 1 - Math.pow(1 - k, 4);
        const x = i % W, y = (i / W) | 0;
        buf[Math.round(sy[i] + (y - sy[i]) * e) * W + Math.round(sx[i] + (x - sx[i]) * e)] = src[i];
      }
      g.putImageData(out, 0, 0);
      if (landed) done();
      else requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  build();
  frame(0, 0);
  const begin = () => {
    canvas.dataset.ready = '';
    start = performance.now();
    new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible) go();
    }).observe(canvas);
  };
  if (reduce) begin();
  else assemble(begin);
  if (reduce || anchor === 'bottom') addEventListener('scroll', () => !running && frame((performance.now() - start) / 1000, 0), { passive: true });
  addEventListener('resize', () => { build(); frame(0, 0); });
}
