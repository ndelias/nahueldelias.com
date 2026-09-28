// §3 enums, shared by the content schema and the components that render it.

// Sections of weighted entries. Writing is its own model (Essay), outside the
// weight and decision rules.
export const SECTIONS = ['work', 'studies', 'data', 'play'] as const;
export type Section = (typeof SECTIONS)[number];

export const STATUSES = ['shipped', 'concept', 'wip', 'archived'] as const;
export type Status = (typeof STATUSES)[number];

export const ESSAY_STATUSES = ['draft', 'published'] as const;
export type EssayStatus = (typeof ESSAY_STATUSES)[number];
