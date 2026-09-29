import { getCollection, type CollectionEntry } from 'astro:content';
import { SECTIONS, type Section } from './model';

// The one way pages read §3 entries. Importing this module runs rule 1 across
// every section, so any page that renders an entry fails the build when the
// rule is broken, not only the homepage.

export type Entry = CollectionEntry<Section>;

const MAX_WEIGHT_ONE = 2;

const everything: Entry[] = (await Promise.all(SECTIONS.map((section) => getCollection(section)))).flat();

const fileOf = (entry: Entry) => entry.filePath ?? `src/content/${entry.collection}/${entry.id}.mdx`;

// Hub and parts (§3). A part names its hub in `parent` and lives in the hub's
// folder (work/vers1ons/licensing.mdx → /work/vers1ons/licensing/). The
// per-entry part rules (weight 2, decision, gallery) are in the schema; these
// need the hub.
const isPart = (entry: Entry) => entry.data.parent !== undefined;
const partProblems: string[] = [];
for (const entry of everything) {
  const { parent } = entry.data;
  if (parent === undefined) {
    if (entry.id.includes('/')) {
      partProblems.push(`${fileOf(entry)}: only parts live in a subfolder. Set parent: '${entry.id.split('/')[0]}', or move the file up.`);
    }
    continue;
  }
  const hub = everything.find((e) => e.collection === entry.collection && e.id === parent);
  if (!hub) {
    const hubs = everything.filter((e) => e.collection === entry.collection && e.data.weight === 1 && !isPart(e)).map((e) => e.id);
    partProblems.push(`${fileOf(entry)}: parent '${parent}' isn't an entry in ${entry.collection}. Weight 1 entries there: ${hubs.join(', ') || 'none'}.`);
  } else if (isPart(hub)) {
    partProblems.push(`${fileOf(entry)}: parent '${parent}' is itself a part. Parts hang off a hub, one level deep.`);
  } else if (hub.data.weight !== 1) {
    partProblems.push(`${fileOf(entry)}: parent '${parent}' is weight ${hub.data.weight}. Only a weight 1 entry can be a hub.`);
  } else if (!entry.id.startsWith(`${parent}/`) || entry.id.split('/').length !== 2) {
    partProblems.push(`${fileOf(entry)}: a part lives in its hub's folder, src/content/${entry.collection}/${parent}/.`);
  }
}
if (partProblems.length) {
  throw new Error(['Parts must point to an existing weight 1 hub (§3 hub and parts):', ...partProblems.map((p) => `  ${p}`)].join('\n'));
}

// Top-level entries: everything but parts. Parts don't count toward the
// weight 1 cap and never appear in the homepage strip or Index; they're
// reached from their hub.
const all = everything.filter((entry) => !isPart(entry));

// Rule 1 (§3): at most two entries carry the hire. Anti-flattening, so it throws.
const weightOne = all.filter((entry) => entry.data.weight === 1);
if (weightOne.length > MAX_WEIGHT_ONE) {
  throw new Error(
    [
      `At most ${MAX_WEIGHT_ONE} entries may have weight: 1 (§3 rule 1). Found ${weightOne.length}:`,
      ...weightOne.map((entry) => `  ${fileOf(entry)}`),
      'Demote all but two to weight: 2.',
    ].join('\n'),
  );
}

// Launch gate (§9 step 6): a SHIP=1 build proves no placeholder shipped. Any
// fixture left in the content fails it, listing every one.
if (process.env.SHIP === '1') {
  const fixtures = everything.filter((entry) => entry.data.fixture);
  if (fixtures.length) {
    throw new Error(
      [
        `SHIP=1: ${fixtures.length} fixture ${fixtures.length === 1 ? 'entry' : 'entries'} can't ship:`,
        ...fixtures.map((entry) => `  ${fileOf(entry)}`),
        'Replace each with the real entry or delete it.',
      ].join('\n'),
    );
  }
}

const byOrder = (a: Entry, b: Entry) => a.data.order - b.data.order;

export const allEntries = (): Entry[] => [...all].sort(byOrder);

/** A hub's parts, in build order. Empty for any other entry. */
export const partsOf = (hub: Entry): Entry[] =>
  everything.filter((e) => e.collection === hub.collection && e.data.parent === hub.id).sort(byOrder);

/** A part's hub. */
export const parentOf = (part: Entry): Entry | undefined =>
  part.data.parent === undefined ? undefined : all.find((e) => e.collection === part.collection && e.id === part.data.parent);

/** A part's previous and next sibling, cycling through the hub's parts. */
export const siblingsOf = (part: Entry): { prev: Entry; next: Entry } | undefined => {
  const hub = parentOf(part);
  if (!hub) return undefined;
  const parts = partsOf(hub);
  const at = parts.indexOf(part);
  return { prev: parts[(at - 1 + parts.length) % parts.length], next: parts[(at + 1) % parts.length] };
};

/** The part's own slug: "distribution" for vers1ons/distribution. */
export const partSlug = (part: Entry): string => part.id.slice(part.id.indexOf('/') + 1);

export const entriesIn = <S extends Section>(section: S) =>
  all.filter((entry): entry is CollectionEntry<S> => entry.collection === section).sort(byOrder);

// Homepage order (§7.5): the two weight 1 entries first, then by order.
export const homepageEntries = (): Entry[] =>
  [...all].sort((a, b) => Number(b.data.weight === 1) - Number(a.data.weight === 1) || byOrder(a, b));

const PREFIX: Record<Section, string> = { work: 'W', studies: 'S', data: 'D', play: 'P' };
export const SECTION_LABELS: Record<Section, string> = { work: 'Work', studies: 'Study', data: 'Data', play: 'Play' };

/** W01, S02…: section letter and position within the section. A part adds its position under the hub: W01.5. */
export const entryNumber = (entry: Entry): string => {
  const hub = parentOf(entry);
  if (hub) return `${entryNumber(hub)}.${partsOf(hub).indexOf(entry) + 1}`;
  return PREFIX[entry.collection] + String(entriesIn(entry.collection).indexOf(entry) + 1).padStart(2, '0');
};

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

/** The entry after this one in homepage order that has a page, wrapping around. */
export const nextEntry = (entry: Entry): Entry | undefined => {
  const list = homepageEntries();
  const at = list.indexOf(entry);
  for (let step = 1; step < list.length; step++) {
    const next = list[(at + step) % list.length];
    if (entryHref(next)) return next;
  }
  return undefined;
};

/** The date of the latest build log entry: the site's "Updated" date. */
export const lastUpdated = async (): Promise<Date | undefined> =>
  (await getCollection('log')).map((e) => e.data.date).sort((a, b) => b.getTime() - a.getTime())[0];
