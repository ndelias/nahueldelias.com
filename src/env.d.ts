// Per-page render state, set by a page for components MDX renders without
// props. A part page puts its gallery and comparisons here, so <Screens />
// and <Comparisons /> in the body render them where the author placed them,
// and a part told in tabs puts its tabs here for <Tabs> and <Tab>.
declare namespace App {
  interface Locals {
    gallery?: { src: import('astro').ImageMetadata; alt: string; caption?: string; frame: import('./lib/model').FrameType; more?: boolean; title?: string; clip?: string }[];
    comparisons?: import('./components/Comparisons.astro').Comparison[];
    // The page's phone screens (<MobileDesign />): the open tab's, or the part's.
    phones?: { src: import('astro').ImageMetadata; alt: string; caption?: string; frame: import('./lib/model').FrameType; more?: boolean }[];
    // A part told in tabs: the open one, and every tab with its URL.
    tabs?: {
      open: NonNullable<import('./lib/entries').Entry['data']['tabs']>[number];
      list: { id: string; label: string; caption: string; href: string }[];
    };
  }
}
