// M04, the tape slider, rebuilt from vers1ons' audio editor
// (ScrollTickSlider, live in the audio player since March 2026). The
// playhead stays put and a ruler of ticks is pulled under it, 8px a step.
// Ticks grow and darken toward the playhead (a quadratic falloff). At either
// end of the range a red wall comes into view and the tape stops there.
// Values round to the step and catch on the default nearby (speed lands on
// 100% within one step). Double-click resets. Varispeed turns pitch off, as
// in the product. Drawn on a canvas at the device's pixel ratio, in the
// page's ink and warn colors, re-read when the theme changes.
//
// New here, not in the product: each tape is a keyboard slider (arrows a
// step, Page Up/Down five, Home/End the ends) announced to screen readers,
// and after a drag, key or reset the tape rolls onto its value on a spring
// rather than jumping there. Reduced motion: it jumps. Also fixed: the
// catch on the default compares floats with a tolerance (see snap()).

import { define } from '../runtime';
import { Spring, loop } from '../spring';

const TICK = 8;
const MAX_TICK = 16;
const MIN_TICK = 3;
const THUMB = { w: 2, h: 20 };
const WALL = { w: 2, h: 22 };

interface Spec {
  min: number;
  max: number;
  step: number;
  def: number;
  snap: number;
  format(v: number): string;
}
const sign = (v: number) => (v > 0 ? '+' : '');
// The product's settings (AdjustContent.tsx).
const SPECS: Record<string, Spec> = {
  speed: { min: 0.5, max: 2, step: 0.05, def: 1, snap: 0.05, format: (v) => `${Math.round(v * 100)}%` },
  pitch: { min: -12, max: 12, step: 1, def: 0, snap: 0.5, format: (v) => `${sign(v)}${v} st` },
  gain: { min: -12, max: 12, step: 0.5, def: 0, snap: 0.5, format: (v) => `${sign(v)}${v % 1 === 0 ? v : v.toFixed(1)} dB` },
};

define('tape-slider', (stage, { reduce }) => {
  const editor = stage.querySelector<HTMLElement>('[data-editor]')!;
  const probe = editor.querySelector<HTMLElement>('.wall-probe')!;
  let ink = '';
  let warn = '';
  const colors = () => {
    ink = getComputedStyle(editor).color;
    warn = getComputedStyle(probe).color;
  };
  colors();

  const tapes = [...editor.querySelectorAll<HTMLElement>('[data-row]')].map((row) => {
    const spec = SPECS[row.dataset.row!];
    const canvas = row.querySelector('canvas')!;
    const out = row.querySelector<HTMLElement>('[data-value]')!;
    const g = canvas.getContext('2d')!;
    const at = (v: number) => ((v - spec.def) / spec.step) * TICK;
    const lo = at(spec.min);
    const hi = at(spec.max);
    const clampOffset = (o: number) => Math.min(hi, Math.max(lo, o));
    const decimals = spec.step < 1 ? String(spec.step).split('.')[1].length : 0;
    const snap = (raw: number) => {
      let v = Number((Math.round(raw / spec.step) * spec.step).toFixed(decimals));
      // The tolerance matters: 1.05 - 1 is 0.05000000000000004 in floating
      // point, just over the 0.05 limit, so without it speed never catches
      // (true in the product too, where only gain's catch works).
      if (Math.abs(v - spec.def) <= spec.snap + 1e-9) v = spec.def;
      return Math.min(spec.max, Math.max(spec.min, v));
    };

    let value = spec.def;
    const offset = new Spring(0, 150); // a roll you can follow, ~0.4s
    let w = 0;
    let h = 0;

    const draw = () => {
      if (!w) return;
      const dpr = devicePixelRatio || 1;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, w, h);
      const o = clampOffset(offset.value);
      const cx = w / 2;
      const cy = h / 2;
      const minWall = cx - (o - lo);
      const maxWall = cx - (o - hi);
      const frac = ((o % TICK) + TICK) % TICK;
      const n = Math.ceil(w / TICK) + 6;
      g.fillStyle = ink;
      for (let i = -Math.ceil(n / 2); i <= Math.ceil(n / 2); i++) {
        const x = cx + i * TICK - frac;
        if (x < -1 || x > w + 1 || x < minWall - 0.5 || x > maxWall + 0.5) continue;
        const fall = Math.max(0, 1 - Math.abs(x - cx) / cx) ** 2;
        const th = MIN_TICK + (MAX_TICK - MIN_TICK) * fall;
        g.globalAlpha = 0.06 + 0.35 * fall;
        g.fillRect(Math.round(x), cy - th / 2, 1, th);
      }
      g.fillStyle = warn;
      g.globalAlpha = 0.6;
      for (const x of [minWall, maxWall]) if (x >= 0 && x <= w) g.fillRect(Math.round(x) - WALL.w / 2, cy - WALL.h / 2, WALL.w, WALL.h);
      g.fillStyle = ink;
      g.globalAlpha = 0.9;
      g.fillRect(Math.round(cx) - THUMB.w / 2, cy - THUMB.h / 2, THUMB.w, THUMB.h);
      g.globalAlpha = 1;
    };
    const size = () => {
      const dpr = devicePixelRatio || 1;
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      draw();
    };

    const show = () => {
      out.textContent = spec.format(value);
      canvas.setAttribute('aria-valuenow', String(value));
      canvas.setAttribute('aria-valuetext', spec.format(value));
    };
    // Set a value and roll the tape to it.
    const set = (v: number) => {
      value = snap(v);
      show();
      offset.target = at(value);
      if (reduce) offset.snap();
      anim.start();
    };

    canvas.setAttribute('role', 'slider');
    canvas.tabIndex = 0;
    canvas.setAttribute('aria-valuemin', String(spec.min));
    canvas.setAttribute('aria-valuemax', String(spec.max));
    show();

    // Dragging pulls the tape 1:1 under the pointer (drag right, the tape
    // goes right, the value goes down), clamped at the walls; the value is
    // the nearest step. On release the tape rolls onto that step.
    let drag: { x: number; from: number } | null = null;
    // Off (pitch under Varispeed): the row's styles already stop the pointer
    // and it leaves the tab order, but the tape refuses input itself too.
    const off = () => row.classList.contains('off');
    canvas.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || off()) return;
      canvas.setPointerCapture(e.pointerId);
      offset.value = offset.target = clampOffset(offset.value);
      offset.velocity = 0;
      drag = { x: e.clientX, from: offset.value };
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const o = clampOffset(drag.from - (e.clientX - drag.x));
      offset.value = offset.target = o;
      value = snap(spec.def + (o / TICK) * spec.step);
      show();
      draw();
    });
    const end = () => {
      if (!drag) return;
      drag = null;
      set(value);
    };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
    canvas.addEventListener('lostpointercapture', end);
    canvas.addEventListener('dblclick', () => !off() && set(spec.def));
    canvas.addEventListener('keydown', (e) => {
      if (off()) return;
      const by = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1, PageUp: 5, PageDown: -5 }[e.key];
      const to = e.key === 'Home' ? spec.min : e.key === 'End' ? spec.max : by !== undefined ? value + by * spec.step : null;
      if (to === null) return;
      e.preventDefault();
      // Stepping off the default by one must move, not catch straight back.
      value = Math.min(spec.max, Math.max(spec.min, Number(to.toFixed(decimals))));
      show();
      offset.target = at(value);
      if (reduce) offset.snap();
      anim.start();
    });

    return { row, canvas, offset, draw, size, set, spec, dragging: () => !!drag };
  });

  const anim = loop((dt) => {
    let moving = false;
    for (const t of tapes) {
      if (t.dragging() || t.offset.resting(0.1)) {
        if (!t.dragging() && t.offset.value !== t.offset.target) {
          t.offset.snap();
          t.draw();
        }
        continue;
      }
      t.offset.step(dt);
      t.draw();
      moving = true;
    }
    return moving;
  });

  // Varispeed ties pitch to speed in the product, so pitch goes inactive.
  const vari = editor.querySelector<HTMLButtonElement>('[data-vari]')!;
  const pitch = tapes.find((t) => t.row.dataset.row === 'pitch')!;
  vari.addEventListener('click', () => {
    const on = vari.getAttribute('aria-pressed') !== 'true';
    vari.setAttribute('aria-pressed', String(on));
    pitch.row.classList.toggle('off', on);
    pitch.canvas.tabIndex = on ? -1 : 0;
    pitch.canvas.setAttribute('aria-disabled', String(on));
  });
  editor.querySelector('[data-reset]')!.addEventListener('click', () => tapes.forEach((t) => t.set(t.spec.def)));

  const ro = new ResizeObserver(() => tapes.forEach((t) => t.size()));
  tapes.forEach((t) => ro.observe(t.canvas));
  new MutationObserver(() => {
    colors();
    tapes.forEach((t) => t.draw());
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  editor.classList.add('on');
});
