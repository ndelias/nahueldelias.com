// §3 enums, shared by the content schema and the components that render it.

export const SECTIONS = ['work', 'studies', 'data', 'play', 'writing'] as const;
export type Section = (typeof SECTIONS)[number];

export const STATUSES = ['shipped', 'concept', 'wip', 'archived'] as const;
export type Status = (typeof STATUSES)[number];
