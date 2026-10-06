// Per-page render state, set by a page for components MDX renders without
// props. A part page puts its gallery and comparisons here, so <Screens />
// and <Comparisons /> in the body render them where the author placed them.
declare namespace App {
  interface Locals {
    gallery?: { src: import('astro').ImageMetadata; alt: string; caption?: string; frame: import('./lib/model').FrameType; more?: boolean; title?: string; clip?: string }[];
    comparisons?: import('./components/Comparisons.astro').Comparison[];
  }
}
