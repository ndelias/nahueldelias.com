// /motion's pieces, in order, split into pages so each page's HTML stays in
// the budget (scripts/check-html.mjs): /motion holds the first screen,
// /motion/2/ onward the rest, a few at a time. With JS, /motion fetches the
// next page as its end nears and appends its pieces (src/scripts/motion.ts);
// without, the pages are linked.
import { getCollection, type CollectionEntry } from 'astro:content';

export type Piece = CollectionEntry<'motion'>;

/** Pieces in the HTML of /motion itself. */
export const FIRST = 4;
/** Pieces per following page. */
export const PER_PAGE = 6;

export async function motionPieces(): Promise<Piece[]> {
  const pieces = (await getCollection('motion')).sort((a, b) => a.data.number - b.data.number);
  pieces.forEach((p, i) => {
    if (pieces[i - 1]?.data.number === p.data.number) throw new Error(`/motion: "${pieces[i - 1].id}" and "${p.id}" are both number ${p.data.number}.`);
  });
  return pieces;
}

/** The pieces on each page, first page first. */
export function paginate(pieces: Piece[]): Piece[][] {
  const pages = [pieces.slice(0, FIRST)];
  for (let i = FIRST; i < pieces.length; i += PER_PAGE) pages.push(pieces.slice(i, i + PER_PAGE));
  return pages;
}

export const pageHref = (page: number) => (page === 1 ? '/motion/' : `/motion/${page}/`);
