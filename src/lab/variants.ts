// The design lab: layouts of a page tried side by side, in development
// only (/_lab). Each variant records where it sits on the variation dial,
// per layer: 0 is a close refinement of what's live, 100 an all-new
// direction. Round 1 (homepage) keeps the design system close and varies
// the layout. Round 2 combines the parts Nahuel picked from round 1, and
// round 3 builds on Split, his pick after seeing round 2.

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
  /** The round it came from: 2 combines parts of round 1's layouts. */
  round?: number;
}

export const BASELINE: Variant = {
  id: 'today',
  name: 'Today',
  idea: 'The live homepage, for comparison.',
  dial: { system: 0, layout: 0 },
  // The live site, not the dev server's /, which is now round 3 itself.
  href: 'https://nahueldelias.com/',
};

export const HOME_VARIANTS: Variant[] = [
  {
    id: 'split-lead',
    name: 'Split, vers1ons first',
    idea: 'Split as the base, with vers1ons leading the work and bigger than the rest, a compact row for me on a phone, and a description that starts with the people I build for.',
    dial: { system: 10, layout: 70 },
    href: '/_lab/home/split-lead/',
    round: 3,
  },
  {
    id: 'combined',
    name: 'Work first, combined',
    idea: 'Work first as the base, with vers1ons leading the work with all its numbers and parts (from Lead project) and the short list of how I think (from Split).',
    dial: { system: 10, layout: 60 },
    href: '/_lab/home/combined/',
    round: 2,
  },
  {
    id: 'work-first',
    name: 'Work first',
    idea: 'One sentence about you with the work peeking up from the first screen, then big cards that show the product.',
    dial: { system: 10, layout: 60 },
    href: '/_lab/home/work-first/',
    round: 1,
  },
  {
    id: 'lead-project',
    name: 'Lead project',
    idea: 'vers1ons as a big feature with all its numbers and parts, the rest as a compact list.',
    dial: { system: 10, layout: 55 },
    href: '/_lab/home/lead-project/',
    round: 1,
  },
  {
    id: 'split',
    name: 'Split',
    idea: 'You on the left the whole time, the work and experience scrolling on the right.',
    dial: { system: 10, layout: 75 },
    href: '/_lab/home/split/',
    round: 1,
  },
];
