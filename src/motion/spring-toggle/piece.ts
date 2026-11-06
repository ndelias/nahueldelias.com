// M01, the spring toggle. Each edge of the pill has its own spring. On a
// change, the edge on the side it's heading to is stiff and a little
// underdamped (it gets there first and overshoots a touch); the other is
// soft and nearly critical (it follows). So the pill stretches toward the
// new option and gathers itself behind. Retargeting mid-flight keeps the
// velocity. Arrow keys, Home and End move the choice, as in any radio
// group. Until someone touches it, it steps through the options on its own
// while it's on screen. Reduced motion: the pill jumps, nothing plays.

import { define } from '../runtime';
import { Spring, loop } from '../spring';

const LEAD = { k: 520, ratio: 0.72 };
const TRAIL = { k: 150, ratio: 0.95 };
const AUTO_MS = 2400;
const INSET = 4; // the toggle's padding: the ink row starts there

const tune = (s: Spring, { k, ratio }: typeof LEAD) => {
  s.stiffness = k;
  s.damping = 2 * ratio * Math.sqrt(k);
};

define('spring-toggle', (stage, { reduce }) => {
  const toggle = stage.querySelector<HTMLElement>('[data-toggle]')!;
  const ink = toggle.querySelector<HTMLElement>('.ink')!;
  const buttons = [...toggle.querySelectorAll<HTMLButtonElement>('[role="radio"]')];
  let index = Math.max(0, buttons.findIndex((b) => b.getAttribute('aria-checked') === 'true'));

  const edges = () => {
    const b = buttons[index];
    return [b.offsetLeft - INSET, b.offsetLeft - INSET + b.offsetWidth];
  };
  const [l0, r0] = edges();
  const left = new Spring(l0);
  const right = new Spring(r0);
  let width = ink.offsetWidth;

  const draw = () => {
    ink.style.clipPath = `inset(0 ${(width - right.value).toFixed(2)}px 0 ${left.value.toFixed(2)}px round 999px)`;
  };
  const settle = () => {
    left.snap();
    right.snap();
    draw();
  };
  const anim = loop((dt) => {
    left.step(dt);
    right.step(dt);
    if (left.resting() && right.resting()) {
      settle();
      return false;
    }
    draw();
    return true;
  });

  const select = (i: number) => {
    if (i === index) return;
    const heading = i > index ? right : left;
    buttons[index].setAttribute('aria-checked', 'false');
    buttons[index].tabIndex = -1;
    buttons[i].setAttribute('aria-checked', 'true');
    buttons[i].tabIndex = 0;
    index = i;
    tune(heading, LEAD);
    tune(heading === right ? left : right, TRAIL);
    [left.target, right.target] = edges();
    if (reduce) settle();
    else anim.start();
  };

  // Steps through on its own until the first touch, key or focus.
  let timer = 0;
  let touched = false;
  const play = () => {
    if (reduce || touched || timer) return;
    timer = window.setInterval(() => select((index + 1) % buttons.length), AUTO_MS);
  };
  const pause = () => {
    clearInterval(timer);
    timer = 0;
  };
  const touch = () => {
    touched = true;
    pause();
  };
  toggle.addEventListener('pointerdown', touch);
  toggle.addEventListener('focusin', touch);

  buttons.forEach((b, i) => b.addEventListener('click', () => select(i)));
  toggle.addEventListener('keydown', (e) => {
    const n = buttons.length;
    const to = { ArrowRight: index + 1, ArrowDown: index + 1, ArrowLeft: index - 1, ArrowUp: index - 1, Home: 0, End: n - 1 }[e.key];
    if (to === undefined) return;
    e.preventDefault();
    select((to + n) % n);
    buttons[index].focus();
  });

  // Labels reflow when the font arrives or the stage resizes: jump there.
  new ResizeObserver(() => {
    width = ink.offsetWidth;
    [left.target, right.target] = edges();
    anim.stop();
    settle();
  }).observe(toggle);

  toggle.classList.add('on');
  draw();
  return { play, pause };
});
