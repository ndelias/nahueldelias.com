// What the editor can change on Split, vers1ons first (round 3).
import type { Editable } from '../settings';
import { STATEMENT } from '../../lib/home';

export const SPLIT_LEAD: Editable = {
  sections: [
    { key: 'work', label: 'My work' },
    { key: 'about', label: 'About me' },
    { key: 'experience', label: 'Experience' },
  ],
  controls: [
    { key: 'side', label: 'Your column (of 12)', min: 3, max: 6, step: 1, unit: '', value: 4 },
    { key: 'portrait', label: 'Portrait', min: 96, max: 320, step: 8, unit: 'px', value: 200 },
    { key: 'name-size', label: 'Name size', min: 24, max: 64, step: 1, unit: 'px', value: 40 },
    { key: 'line-size', label: 'Description size', min: 14, max: 24, step: 1, unit: 'px', value: 17 },
    { key: 'rest-cols', label: 'Other projects per row', min: 1, max: 3, step: 1, unit: '', value: 2 },
    { key: 'card-gap', label: 'Space between projects', min: 32, max: 160, step: 8, unit: 'px', value: 64 },
    { key: 'section-gap', label: 'Space between sections', min: 64, max: 240, step: 8, unit: 'px', value: 160 },
  ],
  text: {
    line: {
      label: 'Description',
      // A first draft from Nahuel's two picks (2026-11-25). His to edit.
      value: "I work closely with users and clients. I start with the people I'm building for, and use today's tools to get them something better, faster.",
    },
    statement: { label: 'About me', value: STATEMENT },
  },
};
