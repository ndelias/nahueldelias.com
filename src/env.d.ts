// Per-page render state, set by a page for components MDX renders without
// props. A part page puts its gallery here, so <Screens /> in the body can
// render it where the author placed it.
declare namespace App {
  interface Locals {
    gallery?: { src: import('astro').ImageMetadata; alt: string; caption?: string; frame: import('./lib/model').FrameType }[];
  }
}
