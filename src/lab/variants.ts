// The design lab: layouts of a page tried side by side, in development
// only (/_lab). Each variant records where it sits on the variation dial,
// per layer: 0 is a close refinement of what's live, 100 an all-new
// direction. Round 1 (homepage) keeps the design system close and varies
// the layout.

export interface Dial {
  /** Tokens: color, type, spacing, radius, motion. */
  system: number;
  /** Structure: what comes first, how big, in what order. */
  layout: number;
}

export interface Variant {
  id: string;
  name: string;
  /** One line: what this layout tries. */
  idea: string;
  dial: Dial;
  /** Where it renders. The baseline is the live site. */
  href: string;
}

export const BASELINE: Variant = {
  id: 'today',
  name: 'Today',
  idea: 'The live homepage, for comparison.',
  dial: { system: 0, layout: 0 },
  // The live site, not the dev server's /: under `astro dev` the homepage's
  // behaviours (about.ts) don't run, so the meadow and portrait stay blank.
  href: 'https://nahueldelias.com/',
};

export const HOME_VARIANTS: Variant[] = [
  {
    id: 'work-first',
    name: 'Work first',
    idea: 'One sentence about you with the work peeking up from the first screen, then big cards that show the product.',
    dial: { system: 10, layout: 60 },
    href: '/_lab/home/work-first/',
  },
  {
    id: 'lead-project',
    name: 'Lead project',
    idea: 'vers1ons as a big feature with all its numbers and parts, the rest as a compact list.',
    dial: { system: 10, layout: 55 },
    href: '/_lab/home/lead-project/',
  },
  {
    id: 'split',
    name: 'Split',
    idea: 'You on the left the whole time, the work and experience scrolling on the right.',
    dial: { system: 10, layout: 75 },
    href: '/_lab/home/split/',
  },
];
