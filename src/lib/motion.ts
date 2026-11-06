// /motion's pieces, in order, split into pages so each page's HTML stays in
// the budget (scripts/check-html.mjs): /motion holds the first screen,
// /motion/2/ onward the rest, a few at a time. With JS, /motion fetches the
// next page as its end nears and appends its pieces (src/scripts/motion.ts);
// without, the pages are linked.
import { getCollection, type CollectionEntry } from 'astro:content';
import { HEADER, pack, parseSize } from './sheet';

export type Piece = CollectionEntry<'motion'>;

/** Pieces in the HTML of /motion itself. */
export const FIRST = 4;
/** Pieces per following page. */
export const PER_PAGE = 6;

// Which pieces have code: src/motion/<id>/ with its Stage.astro and piece.ts.
const stages = Object.keys(import.meta.glob('../motion/*/Stage.astro'));
const scripts = Object.keys(import.meta.glob('../motion/*/piece.ts'));

export async function motionPieces(): Promise<Piece[]> {
  const pieces = (await getCollection('motion')).sort((a, b) => a.data.number - b.data.number);
  for (const { id } of pieces) {
    if (!stages.includes(`../motion/${id}/Stage.astro`) || !scripts.includes(`../motion/${id}/piece.ts`)) {
      throw new Error(`/motion: "${id}" has no piece. Add src/motion/${id}/Stage.astro and piece.ts.`);
    }
  }
  pieces.forEach((p, i) => {
    if (pieces[i - 1]?.data.number === p.data.number) throw new Error(`/motion: "${pieces[i - 1].id}" and "${p.id}" are both number ${p.data.number}.`);
  });
  // The sheet's rows have to fill (src/lib/sheet.ts): a gap is a size to fix.
  const [gap] = pack([HEADER, ...pieces.map((p) => parseSize(p.data.size))]);
  if (gap) {
    // A gap is always above some piece (gaps in the last row don't count);
    // item 0 is the header, so piece i is item i + 1.
    const next = pieces[gap.before - 1];
    const cols = gap.from === gap.to ? `column ${gap.from}` : `columns ${gap.from}–${gap.to}`;
    throw new Error(`/motion: the sheet leaves row ${gap.row}, ${cols}, empty${next ? ` before "${next.id}"` : ''}. Change the sizes around it so the row fills.`);
  }
  return pieces;
}

/** The pieces on each page, first page first. */
export function paginate(pieces: Piece[]): Piece[][] {
  const pages = [pieces.slice(0, FIRST)];
  for (let i = FIRST; i < pieces.length; i += PER_PAGE) pages.push(pieces.slice(i, i + PER_PAGE));
  return pages;
}

export const pageHref = (page: number) => (page === 1 ? '/motion/' : `/motion/${page}/`);
