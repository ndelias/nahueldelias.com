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

// Launch gate (§9 step 6): a SHIP=1 build proves no placeholder shipped. Any
// fixture left in the content fails it, listing every one.
if (process.env.SHIP === '1') {
  const fixtures = all.filter((entry) => entry.data.fixture);
  if (fixtures.length) {
    throw new Error(
      [
        `SHIP=1: ${fixtures.length} fixture ${fixtures.length === 1 ? 'entry' : 'entries'} can't ship:`,
        ...fixtures.map((entry) => `  ${entry.filePath ?? `${entry.collection}/${entry.id}`}`),
        'Replace each with the real entry or delete it.',
      ].join('\n'),
    );
  }
}

const byOrder = (a: Entry, b: Entry) => a.data.order - b.data.order;

export const allEntries = (): Entry[] => [...all].sort(byOrder);

export const entriesIn = <S extends Section>(section: S) =>
  all.filter((entry): entry is CollectionEntry<S> => entry.collection === section).sort(byOrder);

// Homepage order (§7.5): the two weight 1 entries first, then by order.
export const homepageEntries = (): Entry[] =>
  [...all].sort((a, b) => Number(b.data.weight === 1) - Number(a.data.weight === 1) || byOrder(a, b));

const PREFIX: Record<Section, string> = { work: 'W', studies: 'S', data: 'D', play: 'P' };
export const SECTION_LABELS: Record<Section, string> = { work: 'Work', studies: 'Study', data: 'Data', play: 'Play' };

/** W01, S02…: section letter and position within the section. */
export const entryNumber = (entry: Entry): string =>
  PREFIX[entry.collection] + String(entriesIn(entry.collection).indexOf(entry) + 1).padStart(2, '0');

const year = (date: string) => (date.startsWith('[') ? date : date.slice(0, 4));

/** Start year, "2024–2026" when an end year differs, or a fixture's placeholder as written. */
export function entryYears(entry: Entry): string {
  const { start, end } = entry.data.dates;
  const from = year(start);
  const to = end && year(end);
  return !to || to === from ? from : `${from}–${to}`;
}

// Sections with a detail page so far. The rest render in indexes without a
// link until their template exists (§9 step 7), never as a dead one.
const DETAIL_PAGES: Partial<Record<Section, string>> = { work: '/work/' };

export const entryHref = (entry: Entry): string | undefined => {
  const base = DETAIL_PAGES[entry.collection];
  return base && `${base}${entry.id}/`;
};
