// The contract between /motion's loader (src/scripts/motion.ts) and each
// piece (src/motion/<id>/piece.ts). A piece is its own small script, added
// by the loader when its stage nears the viewport. It calls define() with a
// mount function; the loader runs it on the piece's stage and then plays or
// pauses what it returns as the stage comes and goes from view (or the tab
// is hidden). Pieces that only move when touched can return nothing.

export interface Controls {
  play?(): void;
  pause?(): void;
}
export interface MountOptions {
  /** prefers-reduced-motion: show the end state, don't animate toward it. */
  reduce: boolean;
}
export type Mount = (stage: HTMLElement, options: MountOptions) => Controls | void;

declare global {
  interface Window {
    __motion?: { define(id: string, mount: Mount): void };
  }
}

export function define(id: string, mount: Mount) {
  window.__motion?.define(id, mount);
}
