// M09, orbit springs. /work's constellation moves every card with a damped
// spring per property toward a target set by a little state (src/lib/
// orbit.ts: stiffness 95, critical damping 2√95). Here: a row of cards with
// one forward; pick another (or let it step on its own until touched) and
// each card's x and scale spring to their new targets, the forward card
// larger, its neighbours parting. The dials set stiffness and the damping
// ratio (1 is critical: the fastest return with no overshoot; below it the
// cards overshoot and ring). The curve is the path a card takes from 0 to
// its target with these settings, over 1.2s, recomputed as the dials move.
// Reduced motion: the cards jump, and the curve still shows the motion.

import { define } from '../runtime';
import { Spring, loop } from '../spring';

const GAP = 76; // px between card centres
const PART = 26; // px the forward card's neighbours move aside
const AUTO_MS = 2200;

define('orbit-springs', (stage, { reduce }) => {
  const lab = stage.querySelector<HTMLElement>('[data-lab]')!;
  const cards = [...lab.querySelectorAll<HTMLButtonElement>('[data-card]')];
  const kIn = lab.querySelector<HTMLInputElement>('[data-k]')!;
  const zIn = lab.querySelector<HTMLInputElement>('[data-z]')!;
  const kOut = lab.querySelector<HTMLOutputElement>('[data-k-out]')!;
  const zOut = lab.querySelector<HTMLOutputElement>('[data-z-out]')!;
  const path = lab.querySelector<SVGPathElement>('[data-curve]')!;
  const n = cards.length;
  let forward = Math.floor(n / 2);

  const springs = cards.map(() => ({ x: new Spring(0), s: new Spring(1) }));
  const tune = () => {
    const k = Number(kIn.value);
    const z = Number(zIn.value);
    for (const sp of springs)
      for (const s of [sp.x, sp.s]) {
        s.stiffness = k;
        s.damping = 2 * z * Math.sqrt(k);
      }
    kOut.textContent = String(k);
    zOut.textContent = `${z.toFixed(2)}${Math.abs(z - 1) < 0.001 ? ' · critical' : z < 1 ? ' · under' : ' · over'}`;
    // The curve: a unit spring from 0 to 1, simulated the same way.
    const probe = new Spring(0, k, 2 * z * Math.sqrt(k));
    probe.target = 1;
    const pts: string[] = [];
    for (let i = 0; i <= 120; i++) {
      pts.push(`${i},${(48 - probe.value * 36).toFixed(2)}`);
      probe.step(1.2 / 120);
    }
    path.setAttribute('d', `M${pts.join('L')}`);
  };

  const place = () => {
    cards.forEach((c, i) => {
      const off = i - forward;
      springs[i].x.target = off * GAP + Math.sign(off) * PART;
      springs[i].s.target = off === 0 ? 1.3 : 1 - Math.min(2, Math.abs(off)) * 0.08;
      c.setAttribute('aria-pressed', String(off === 0));
      c.style.zIndex = String(n - Math.abs(off));
    });
    if (reduce) springs.forEach((sp) => (sp.x.snap(), sp.s.snap()));
    anim.start();
  };
  const draw = () =>
    cards.forEach((c, i) => {
      const { x, s } = springs[i];
      c.style.transform = `translateX(${x.value.toFixed(2)}px) scale(${s.value.toFixed(4)})`;
    });
  const anim = loop((dt) => {
    let moving = false;
    for (const sp of springs)
      for (const s of [sp.x, sp.s]) {
        if (s.resting(0.002)) s.snap();
        else {
          s.step(dt);
          moving = true;
        }
      }
    draw();
    return moving;
  });

  let timer = 0;
  let touched = false;
  const touch = () => {
    touched = true;
    clearInterval(timer);
    timer = 0;
  };
  lab.addEventListener('pointerdown', touch);
  lab.addEventListener('focusin', touch);
  cards.forEach((c, i) => c.addEventListener('click', () => ((forward = i), place())));
  for (const input of [kIn, zIn]) input.addEventListener('input', tune);

  tune();
  place();
  springs.forEach((sp) => (sp.x.snap(), sp.s.snap()));
  draw();

  return {
    play() {
      if (reduce || touched || timer) return;
      let dir = 1;
      timer = window.setInterval(() => {
        if (forward + dir < 0 || forward + dir >= n) dir = -dir;
        forward += dir;
        place();
      }, AUTO_MS);
    },
    pause() {
      clearInterval(timer);
      timer = 0;
    },
  };
});
