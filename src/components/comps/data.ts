// The comps study's table: Toast and four payments peers, LTM to
// 2026-09-30. Every number carries the source it came from, and a number
// the builder couldn't trace is null and needs the analyst.
//
// SAMPLE NUMBERS. These are placeholders for building the motion, not the
// companies' figures. The real ones come from each company's 10-K, 10-Q and
// Q3 2026 earnings release once Shift4 and Global Payments have filed
// (docs/studies/comps/draft.md). While SAMPLE is true the table says so on
// screen, and the study can't ship.
export const SAMPLE = true;

export const INPUTS = ['cap', 'ev', 'revenue', 'ebitda'] as const;
export type Input = (typeof INPUTS)[number];

export const COLUMNS: Record<Input, { label: string; digits: number }> = {
  cap: { label: 'Market cap', digits: 1 },
  ev: { label: 'EV', digits: 1 },
  revenue: { label: 'LTM revenue', digits: 2 },
  ebitda: { label: 'LTM adj. EBITDA', digits: 2 },
};

/** sourced: straight from a filing. adjusted: the company's own adjusted
 *  figure, footnoted. needs: no line found, so it's left blank. yours:
 *  entered or picked by the analyst, footnoted. */
export type State = 'sourced' | 'adjusted' | 'needs' | 'yours';

export type Line = { label: string; value: number };
export type Source = {
  doc: string;
  lines: Line[];
  /** The line the number came from; null when nothing matched. */
  hit: number | null;
  /** How the table's number is built from the lines, last row the total. */
  build?: { label: string; value: number }[];
  /** Why a number needs the analyst. */
  reason?: string;
};
export type Cell = { value: number | null; state: State; source: Source; note?: string };
export type Company = { name: string; ticker: string; target?: boolean; cells: Record<Input, Cell> };

const PRICE_DATE = '[date]';

// LTM = the last fiscal year, plus this year to date, minus the same
// months last year. The sample splits a number the same way for everyone.
const ltm = (value: number, what: string, release: boolean): Source => {
  const fy = round(value * 0.9);
  const ytd = round(value * 0.78);
  const prior = round(fy + ytd - value);
  return {
    doc: release ? '8-K · Q3 2026 earnings release · Exhibit 99.1' : '10-Q · Q3 2026 · Income statement',
    lines: [
      { label: `${what}, nine months 2025`, value: prior },
      { label: `${what}, nine months 2026`, value: ytd },
    ],
    hit: 1,
    build: [
      { label: 'FY2025, 10-K', value: fy },
      { label: '+ Nine months 2026, 10-Q', value: ytd },
      { label: '− Nine months 2025, 10-Q', value: prior },
      { label: 'LTM', value },
    ],
  };
};

const round = (n: number) => Math.round(n * 100) / 100;
const their = (name: string) => (name.endsWith('s') ? `${name}'` : `${name}'s`);

const company = (name: string, ticker: string, cap: number, ev: number, revenue: number, ebitda: number | null, target = false): Company => {
  const cash = round(Math.max(cap * 0.1, cap - ev));
  const debt = round(ev - cap + cash);
  const price = 40;
  return {
    name,
    ticker,
    target,
    cells: {
      cap: {
        value: cap,
        state: 'sourced',
        source: {
          doc: '10-Q · Q3 2026 · Cover page',
          lines: [
            { label: 'Shares outstanding (bn)', value: round(cap / price) },
            { label: `Share price, ${PRICE_DATE} ($)`, value: price },
          ],
          hit: 0,
          build: [
            { label: 'Shares outstanding (bn)', value: round(cap / price) },
            { label: `× Share price, ${PRICE_DATE}`, value: price },
            { label: 'Market cap', value: cap },
          ],
        },
      },
      ev: {
        value: ev,
        state: 'sourced',
        source: {
          doc: '10-Q · Q3 2026 · Balance sheet',
          lines: [
            { label: 'Cash and cash equivalents', value: cash },
            { label: 'Total debt', value: debt },
          ],
          hit: 1,
          build: [
            { label: 'Market cap', value: cap },
            { label: '+ Total debt', value: debt },
            { label: '− Cash and cash equivalents', value: cash },
            { label: 'Enterprise value', value: ev },
          ],
        },
      },
      revenue: { value: revenue, state: 'sourced', source: ltm(revenue, 'Total revenue', false) },
      ebitda:
        ebitda === null
          ? {
              value: null,
              state: 'needs',
              source: {
                doc: '8-K · Q3 2026 earnings release · Exhibit 99.1',
                lines: [
                  { label: 'Adjusted operating income, LTM', value: 7.4 },
                  { label: 'Depreciation and amortization, LTM', value: 1.1 },
                ],
                hit: null,
                reason: `${their(name)} release reports adjusted operating income, not adjusted EBITDA. Nothing is filled in until you pick a line or enter a number.`,
              },
            }
          : {
              value: ebitda,
              state: 'adjusted',
              source: ltm(ebitda, 'Adjusted EBITDA', true),
              note: `${their(name)} adjusted EBITDA as it reports it, from its Q3 2026 earnings release.`,
            },
    },
  };
};

export const COMPANIES: Company[] = [
  company('Toast', 'TOST', 20, 18.5, 6, 0.6, true),
  company('Block', 'XYZ', 40, 38, 24, 3.4),
  company('Fiserv', 'FISV', 80, 110, 21, null),
  company('Global Payments', 'GPN', 20, 36, 9, 4.5),
  company('Shift4', 'FOUR', 7, 10, 4, 1),
];
