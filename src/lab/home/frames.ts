// A frame of the product for each project's card, taken from its own reel
// (public/media/*), so the cards show the work, not its wordmark. Lab only:
// a winning layout moves these into the entries' posters, through the
// poster budgets (scripts/check-posters.mjs).
import type { ImageMetadata } from 'astro';
import bespoke from './frames/bespoke.webp';
import sourceline from './frames/sourceline.webp';
import vera from './frames/vera.webp';
import vers1ons from './frames/vers1ons.webp';

// vers1ons/reel.mp4 at 1s (Discover), vera/reel.mp4 at 15.2s (signed off),
// sourceline/reel.mp4 at 5.5s (comps with a source open), bespoke/v2-flow.mp4
// at 1s (Discover on a phone).
const FRAMES: Record<string, ImageMetadata> = { vers1ons, vera, sourceline, bespoke };

export const frameOf = (id: string): ImageMetadata | undefined => FRAMES[id];
