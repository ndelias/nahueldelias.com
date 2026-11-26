// The homepage's layout, Split with vers1ons first (round 3 of the design
// lab): what the lab's editor can change on it, and the defaults. Saved
// changes are in src/settings/split-lead.json.
import type { Editable } from '../../lib/layout-settings';

export const SPLIT_LEAD: Editable = {
  sections: [
    { key: 'work', label: 'My work' },
    { key: 'about', label: 'About me' },
    { key: 'experience', label: 'Experience' },
  ],
  controls: [
    { key: 'side', label: 'Your column (of 12)', min: 3, max: 6, step: 1, unit: '', value: 4 },
    { key: 'portrait', label: 'Photo', min: 96, max: 216, step: 8, unit: 'px', value: 200 },
    { key: 'name-size', label: 'Name size', min: 24, max: 64, step: 1, unit: 'px', value: 40 },
    { key: 'line-size', label: 'Description size', min: 14, max: 24, step: 1, unit: 'px', value: 17 },
    { key: 'rest-cols', label: 'Other projects per row', min: 1, max: 3, step: 1, unit: '', value: 2 },
    { key: 'card-gap', label: 'Space between projects', min: 32, max: 160, step: 8, unit: 'px', value: 64 },
    { key: 'section-gap', label: 'Space between sections', min: 64, max: 240, step: 8, unit: 'px', value: 160 },
  ],
  text: {
    // How he thinks about product: each step's longer description, drafted
    // from what he said about his work (2026-11-25). His to rewrite.
    'step-1': {
      label: 'Step 1, Be curious',
      value: "Have conversations with the people you're building for, and listen more than you pitch. Consider every potential customer's perspective, not only the loudest one.",
    },
    'step-2': {
      label: 'Step 2, Understand the problem',
      value: 'Fall in love with the problem, not the solution. Know who has it, how often, and what it costs them, and back that up with data before deciding what to build.',
    },
    'step-3': {
      label: 'Step 3, Map the journey',
      value: 'Map out the product journey for each user, from the first time they hear about it to the day they rely on it. The gaps usually show up in the handoffs.',
    },
    'step-4': {
      label: 'Step 4, Know what the build needs',
      value: 'Understand every requirement before writing code. Work end to end, and know when to pull others in.',
    },
    'step-5': {
      label: 'Step 5, Mindless when it works',
      value: 'When it works, people move through the product without thinking about it. They remember what they got done, not how they did it.',
    },
    line: {
      label: 'Description',
      // A first draft from Nahuel's two picks (2026-11-25). His to edit.
      value: "I work closely with users and clients. I start with the people I'm building for, and use today's tools to get them something better, faster.",
    },
    statement: {
      label: 'About me',
      // What he's built, where he comes from, and how he thinks about product
      // (his words, 2026-11-25).
      value:
        "I'm a founding product engineer at vers1ons, where I've built everything from licensing to payouts to the mobile app. Before that I interned at Techstars, working with startups in their accelerator program, and did client strategy for EY wavespace through USC. From all of it, I've realized that coding is the easy part now. The products that win stay closest to the people using them, and understand and sell the problem better than anyone else.",
    },
  },
};
