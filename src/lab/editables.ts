// What the editor can change on each layout, by layout id. The sliders set
// desktop sizes: on a phone each layout keeps its own.
import { CLOSER, STATEMENT } from '../lib/home';
import type { Editable } from '../lib/layout-settings';
import { SPLIT_LEAD } from '../components/home/split-lead';

const HEADLINE = {
  headline: { label: 'Headline', value: "I'm Nahuel, a product engineer who thinks through the entire product," },
  'headline-tail': { label: 'Headline, second half', value: 'from the first conversation to something people use without thinking.' },
};

const workFirst = (restCols: number): Editable => ({
  sections: [
    { key: 'work', label: 'My work' },
    { key: 'me', label: 'About me' },
    { key: 'experience', label: 'Experience' },
    { key: 'reach', label: 'Contact' },
  ],
  controls: [
    { key: 'headline', label: 'Headline size', min: 40, max: 96, step: 1, unit: 'px', value: 72 },
    { key: 'headline-width', label: 'Headline width (characters)', min: 14, max: 36, step: 1, unit: '', value: 25 },
    { key: 'peek', label: 'How far the work peeks up', min: 0, max: 12, step: 0.5, unit: 'vw', value: 3 },
    { key: 'cols', label: 'Projects per row', min: 1, max: 3, step: 1, unit: '', value: restCols },
    { key: 'card-gap', label: 'Space between projects', min: 32, max: 160, step: 8, unit: 'px', value: 64 },
    { key: 'portrait', label: 'Portrait', min: 160, max: 480, step: 8, unit: 'px', value: 400 },
    { key: 'section-gap', label: 'Space between sections', min: 64, max: 240, step: 8, unit: 'px', value: 160 },
  ],
  text: { ...HEADLINE, statement: { label: 'About me', value: STATEMENT }, closer: { label: 'About me, second line', value: CLOSER } },
});

export const EDITABLES: Record<string, Editable> = {
  'split-lead': SPLIT_LEAD,
  // Round 4: the homepage with lines, each with its own settings.
  'lines-thread': SPLIT_LEAD,
  'lines-tree': SPLIT_LEAD,
  'lines-connector': SPLIT_LEAD,
  // Round 5: the five steps, three ways.
  'steps-branch': SPLIT_LEAD,
  'steps-reveal': SPLIT_LEAD,
  'steps-columns': SPLIT_LEAD,
  'work-first': workFirst(2),
  // Combined: the projects per row are the ones under the vers1ons feature.
  combined: workFirst(3),
  'lead-project': {
    sections: [
      { key: 'feature', label: 'vers1ons' },
      { key: 'more', label: 'More work' },
      { key: 'me', label: 'About me' },
      { key: 'experience', label: 'Experience' },
      { key: 'reach', label: 'Contact' },
    ],
    controls: [
      { key: 'headline', label: 'Headline size', min: 28, max: 64, step: 1, unit: 'px', value: 44 },
      { key: 'headline-width', label: 'Headline width (characters)', min: 16, max: 44, step: 1, unit: '', value: 30 },
      { key: 'thumb', label: 'Other projects, image width', min: 160, max: 440, step: 8, unit: 'px', value: 280 },
      { key: 'portrait', label: 'Portrait', min: 120, max: 400, step: 8, unit: 'px', value: 240 },
      { key: 'section-gap', label: 'Space between sections', min: 64, max: 240, step: 8, unit: 'px', value: 160 },
    ],
    text: { ...HEADLINE, statement: { label: 'About me', value: STATEMENT }, closer: { label: 'About me, second line', value: CLOSER } },
  },
  split: {
    sections: [
      { key: 'work', label: 'My work' },
      { key: 'experience', label: 'Experience' },
    ],
    controls: [
      { key: 'side', label: 'Your column (of 12)', min: 3, max: 6, step: 1, unit: '', value: 4 },
      { key: 'portrait', label: 'Portrait', min: 96, max: 320, step: 8, unit: 'px', value: 200 },
      { key: 'name-size', label: 'Name size', min: 24, max: 64, step: 1, unit: 'px', value: 40 },
      { key: 'line-size', label: 'Description size', min: 14, max: 24, step: 1, unit: 'px', value: 16 },
      { key: 'card-gap', label: 'Space between projects', min: 32, max: 160, step: 8, unit: 'px', value: 96 },
      { key: 'section-gap', label: 'Space between sections', min: 64, max: 240, step: 8, unit: 'px', value: 160 },
    ],
    text: { line: { label: 'Description', value: CLOSER } },
  },
};
