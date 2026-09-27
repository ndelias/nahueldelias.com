import { getCollection, type CollectionEntry } from 'astro:content';
import { SECTIONS, type Section } from './model';

// The one way pages read §3 entries. Importing this module runs rule 1 across
// every section, so any page that renders an entry fails the build when the
// rule is broken, not only the homepage.

export type Entry = CollectionEntry<Section>;

const MAX_WEIGHT_ONE = 2;

const all: Entry[] = (await Promise.all(SECTIONS.map((section) => getCollection(section)))).flat();

// Rule 1 (§3): at most two entries carry the hire. Anti-flattening, so it throws.
const weightOne = all.filter((entry) => entry.data.weight === 1);
if (weightOne.length > MAX_WEIGHT_ONE) {
  throw new Error(
    [
      `At most ${MAX_WEIGHT_ONE} entries may have weight: 1 (§3 rule 1). Found ${weightOne.length}:`,
      ...weightOne.map((entry) => `  ${entry.filePath ?? `${entry.collection}/${entry.id}`}`),
      'Demote all but two to weight: 2.',
    ].join('\n'),
  );
}

const byOrder = (a: Entry, b: Entry) => a.data.order - b.data.order;

export const allEntries = (): Entry[] => [...all].sort(byOrder);

export const entriesIn = <S extends Section>(section: S) =>
  all.filter((entry): entry is CollectionEntry<S> => entry.collection === section).sort(byOrder);
