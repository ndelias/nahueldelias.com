// A damped spring toward a target, stepped in fixed substeps so it behaves
// the same at 60Hz and 120Hz. Retargeting mid-flight keeps the velocity,
// so a change of mind bends the motion instead of restarting it.
// Critical damping is 2√k; less than that overshoots and settles.

export class Spring {
  value: number;
  target: number;
  velocity = 0;
  constructor(
    value: number,
    public stiffness = 170,
    public damping = 2 * Math.sqrt(170),
  ) {
    this.value = this.target = value;
  }
  step(dt: number) {
    const n = Math.max(1, Math.ceil(dt * 240));
    const h = dt / n;
    for (let i = 0; i < n; i++) {
      const a = -this.stiffness * (this.value - this.target) - this.damping * this.velocity;
      this.velocity += a * h;
      this.value += this.velocity * h;
    }
  }
  /** Close enough to still, in the value's own units (px by default). */
  resting(epsilon = 0.05) {
    return Math.abs(this.velocity) < epsilon && Math.abs(this.value - this.target) < epsilon;
  }
  snap() {
    this.value = this.target;
    this.velocity = 0;
  }
}

/** A requestAnimationFrame loop that runs while tick() returns true. */
export function loop(tick: (dt: number) => boolean) {
  let raf = 0;
  let last = 0;
  const frame = (now: number) => {
    // Clamp: a frame after a long pause (a background tab) mustn't jump.
    const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
    last = now;
    raf = tick(dt) ? requestAnimationFrame(frame) : 0;
  };
  return {
    start() {
      if (!raf) {
        last = 0;
        raf = requestAnimationFrame(frame);
      }
    },
    stop() {
      cancelAnimationFrame(raf);
      raf = 0;
    },
  };
}
