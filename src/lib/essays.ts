import { getCollection, type CollectionEntry } from 'astro:content';

// The one way pages read essays. Drafts render in dev and never in production.

export type Essay = CollectionEntry<'writing'>;

const byDateDesc = (a: Essay, b: Essay) => b.data.date.getTime() - a.data.date.getTime();

export const allEssays = async (): Promise<Essay[]> =>
  (await getCollection('writing', (essay) => !import.meta.env.PROD || essay.data.status === 'published')).sort(byDateDesc);
