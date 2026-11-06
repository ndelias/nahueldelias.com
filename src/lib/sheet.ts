// /motion's sheet: a 12-column grid of tiles, each piece sized to what it
// holds ("4x2": four columns, two rows). The grid places them in order, the
// way CSS auto-placement does, so a row only fills if the sizes around it
// add up. pack() places them the same way and reports any gap that isn't in
// the last row, and src/lib/motion.ts fails the build on one. Pure, so the
// tests can run it directly.

export const COLUMNS = 12;
/** On the first page, the header takes the top left of the sheet. */
export const HEADER = { cols: 6, rows: 2 };

export interface Size {
  cols: number;
  rows: number;
}

export const SIZE = /^([3-9]|1[0-2])x([12])$/;

export function parseSize(size: string): Size {
  const m = SIZE.exec(size);
  if (!m) throw new Error(`"${size}" isn't a size. Use columns x rows, like "4x2": 3 to 12 columns, 1 or 2 rows.`);
  return { cols: Number(m[1]), rows: Number(m[2]) };
}

export interface Gap {
  row: number;
  from: number;
  to: number;
  /** Index of the first item placed after the gap opened. */
  before: number;
}

/**
 * Places items the way CSS grid's sparse auto-placement does (a cursor that
 * only moves forward, each item at the first spot after it that fits) and
 * returns the gaps left anywhere above the last item's top row. Rows and
 * columns are 1-based.
 */
export function pack(items: Size[]): Gap[] {
  const taken: boolean[][] = [];
  const isFree = (r: number, c: number, s: Size) => {
    for (let y = r; y < r + s.rows; y++) for (let x = c; x < c + s.cols; x++) if (taken[y]?.[x]) return false;
    return true;
  };
  const placedAt: number[] = [];
  let row = 1;
  let col = 1;
  items.forEach((s, i) => {
    for (;;) {
      if (col + s.cols - 1 > COLUMNS) {
        row++;
        col = 1;
        continue;
      }
      if (isFree(row, col, s)) break;
      col++;
    }
    for (let y = row; y < row + s.rows; y++) for (let x = col; x < col + s.cols; x++) (taken[y] ??= [])[x] = true;
    placedAt[i] = row;
    col += s.cols;
  });
  const last = placedAt.at(-1) ?? 1;
  const gaps: Gap[] = [];
  for (let r = 1; r < last; r++) {
    for (let c = 1; c <= COLUMNS; c++) {
      if (taken[r]?.[c]) continue;
      const from = c;
      while (c < COLUMNS && !taken[r]?.[c + 1]) c++;
      gaps.push({ row: r, from, to: c, before: placedAt.findIndex((p) => p > r) });
    }
  }
  return gaps;
}
