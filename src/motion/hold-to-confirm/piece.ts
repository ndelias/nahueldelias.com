// M02, hold to sign. Holding fills the button in 1.2s; letting go early
// drains it three times faster than it filled, so a slip costs little and
// an accidental tap barely shows. Space and Enter hold it too. At full, it
// says "Signed" (to screen readers as well), a short buzz where the device
// has one, then holds full until it resets: "Signed" fades back to the
// label, then the fill drains. Reduced motion keeps the fill (it's
// the feedback) and drops the flourish. The fill follows the clock, not the
// frame count, so a slow device signs after 1.2s too, and letting go counts
// the time since the last frame.

import { define } from '../runtime';
import { loop } from '../spring';

const HOLD = 1.2; // seconds to fill
const DRAIN = 3; // times faster than filling
const RESET_MS = 2200;
const FADE_MS = 240; // the .done fade in Stage.astro

define('hold-to-confirm', (stage) => {
  const button = stage.querySelector<HTMLButtonElement>('[data-hold]')!;
  const status = stage.querySelector<HTMLElement>('[data-status]')!;
  let p = 0;
  let holding = false;
  let done = false;

  const draw = () => button.style.setProperty('--p', p.toFixed(4));
  // Moves the fill on to now. A long gap (a hidden tab) counts as a frame.
  let last = 0;
  const advance = () => {
    const now = performance.now();
    const dt = last ? Math.min(0.25, (now - last) / 1000) : 1 / 60;
    last = now;
    p = Math.min(1, Math.max(0, p + (holding ? dt / HOLD : (-dt * DRAIN) / HOLD)));
  };
  const anim = loop(() => {
    advance();
    draw();
    if (holding && p === 1) {
      finish();
      last = 0;
      return false; // full until the reset: nothing drains under "Signed"
    }
    const more = holding ? p < 1 : p > 0;
    if (!more) last = 0;
    return more;
  });
  // Starts the fill moving from now (it may already be moving).
  const run = () => {
    if (!last) last = performance.now();
    anim.start();
  };

  const finish = () => {
    holding = false;
    done = true;
    button.classList.remove('held');
    button.classList.add('is-done');
    status.textContent = 'Signed';
    navigator.vibrate?.(12);
    // "Signed" fades back to the full label first, then it drains.
    setTimeout(() => {
      button.classList.remove('is-done');
      status.textContent = '';
      setTimeout(() => {
        done = false;
        run();
      }, FADE_MS);
    }, RESET_MS);
  };
  const press = () => {
    if (done || holding) return;
    holding = true;
    button.classList.add('held');
    run();
  };
  const release = () => {
    if (!holding) return;
    advance();
    draw();
    // Full by the time it was let go: that's a full hold.
    if (p === 1) {
      anim.stop();
      last = 0;
      return finish();
    }
    holding = false;
    button.classList.remove('held');
    run();
  };

  button.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    button.setPointerCapture(e.pointerId);
    press();
  });
  button.addEventListener('pointerup', release);
  button.addEventListener('pointercancel', release);
  button.addEventListener('lostpointercapture', release);
  button.addEventListener('contextmenu', (e) => e.preventDefault());
  button.addEventListener('keydown', (e) => {
    if (e.key !== ' ' && e.key !== 'Enter') return;
    e.preventDefault();
    if (!e.repeat) press();
  });
  button.addEventListener('keyup', (e) => {
    if (e.key === ' ' || e.key === 'Enter') release();
  });
  button.addEventListener('blur', release);
});
