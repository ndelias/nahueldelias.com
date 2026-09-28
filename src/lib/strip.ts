// Geometry of the homepage filmstrip (§7.5), shared by the server render (the
// first frame, painted before any script runs) and the island (every frame
// after). Sizes and gap in design px from docs/design/reference/home.html;
// CSS scales them by --u on phones.
//
// The strip is a ring. N = copies × n frames sit on it, and frame j's offset
// from the focused frame p is wrap(j − p), in [−N/2, N/2). Moving focus
// shifts every offset; the one frame that crosses the far side of the ring
// jumps to the other end with its transition off. The island keeps enough
// copies that the jump always happens off-screen.

export const SIZE = { active: [520, 325], w1: [168, 105], other: [124, 78] } as const;
export const GAP = 14;

/** k mod N, as an offset in [−floor(N/2), ceil(N/2)). */
export function wrap(k: number, N: number): number {
  const m = ((k % N) + N) % N;
  return m >= Math.ceil(N / 2) ? m - N : m;
}

export interface Slot {
  offset: number;
  /** Left edge, relative to the strip's center. */
  x: number;
  w: number;
  h: number;
}

/** Where every frame sits when frame `p` is focused. `weights[i]` is entry i's. */
export function layout(weights: readonly number[], N: number, p: number): Slot[] {
  const n = weights.length;
  const size = (j: number, offset: number) =>
    offset === 0 ? SIZE.active : weights[j % n] === 1 ? SIZE.w1 : SIZE.other;
  const slots: Slot[] = [];
  const byOffset = new Map<number, number>();
  for (let j = 0; j < N; j++) {
    const offset = wrap(j - p, N);
    const [w, h] = size(j, offset);
    slots[j] = { offset, x: 0, w, h };
    byOffset.set(offset, j);
  }
  // Out from the focused frame, both ways.
  let right = -SIZE.active[0] / 2;
  let left = right;
  slots[p].x = right;
  for (let o = 1; byOffset.has(o); o++) {
    right += slots[byOffset.get(o - 1)!].w + GAP;
    slots[byOffset.get(o)!].x = right;
  }
  for (let o = -1; byOffset.has(o); o--) {
    const s = slots[byOffset.get(o)!];
    left -= GAP + s.w;
    s.x = left;
  }
  return slots;
}

/** The frame that stands for its entry: exactly one per entry, around the focus. */
export const isReal = (offset: number, n: number) => offset >= -Math.floor(n / 2) && offset < Math.ceil(n / 2);
