// The comps study's table: Toast and four payments peers, LTM to
// 2026-09-30, prices at the 2026-11-05 close. Every number carries the
// source it came from, and a number the builder couldn't trace is null and
// needs the analyst.
//
// The real figures, from each company's FY2025 10-K, Q3 2026 10-Q, and
// earnings releases, with share prices from Nasdaq.com's historical quotes.
// docs/studies/comps/numbers.md has every figure with its filing, accession
// number, and the decisions behind it. The table's values are in $bn; the
// panel's lines are in $M, as filed, with the filings' own labels.
export const SAMPLE = false;

export const PRICE_DATE = 'Nov 5, 2026';

export const INPUTS = ['cap', 'ev', 'revenue', 'ebitda'] as const;
export type Input = (typeof INPUTS)[number];

export const COLUMNS: Record<Input, { label: string; digits: number }> = {
  cap: { label: 'Market cap', digits: 1 },
  ev: { label: 'EV', digits: 1 },
  revenue: { label: 'LTM revenue', digits: 2 },
  ebitda: { label: 'LTM adj. EBITDA', digits: 2 },
};

/** sourced: straight from a filing. adjusted: the company's own adjusted
 *  figure, or a definition the builder chose, footnoted. needs: no line
 *  found, so it's left blank. yours: entered or picked by the analyst,
 *  footnoted. */
export type State = 'sourced' | 'adjusted' | 'needs' | 'yours';

/** A row in the panel, in $M as the filing has it, unless the label says
 *  otherwise (share counts, prices). `digits` defaults to what the number
 *  needs: none for whole millions, one otherwise. */
export type Line = { label: string; value: number; digits?: number };
export type Source = {
  doc: string;
  lines: Line[];
  /** The line or lines the number came from; null when nothing matched. */
  hit: number | number[] | null;
  /** How the table's number is built from the lines, last row the total. */
  build?: Line[];
  /** Why a number needs the analyst. */
  reason?: string;
};
export type Cell = { value: number | null; state: State; source: Source; note?: string };
export type Company = { name: string; ticker: string; target?: boolean; cells: Record<Input, Cell> };

const bn = (millions: number) => millions / 1000;
const their = (name: string) => (name.endsWith('s') ? `${name}'` : `${name}'s`);
const all = (lines: Line[]) => lines.map((_, i) => i);

const Q3 = '10-Q · Q3 2026';
const RELEASE = '8-K · Q3 2026 earnings release · Exhibit 99.1 · $M';

/** LTM = FY2025 (10-K, or the Q4 2025 release) + nine months 2026 − nine
 *  months 2025, the two nine-month figures read off the same page. */
const ltm = (doc: string, label: string, fyFrom: string, fy: number, ytd: number, prior: number): Source => ({
  doc,
  lines: [
    { label: `${label}, nine months 2025`, value: prior },
    { label: `${label}, nine months 2026`, value: ytd },
  ],
  hit: 1,
  build: [
    { label: `FY2025, ${fyFrom}`, value: fy },
    { label: '+ Nine months 2026', value: ytd },
    { label: '− Nine months 2025', value: prior },
    { label: 'LTM', value: fy + ytd - prior },
  ],
});

/** Market cap: the 10-Q cover's share count × the close on PRICE_DATE. */
const cap = (classes: [string, number][], price: number): Cell => {
  const shares = classes.reduce((a, [, n]) => a + n, 0);
  const lines = classes.map(([label, n]) => ({ label: `${label}, millions`, value: n, digits: n % 1 ? 3 : 0 }));
  return {
    value: bn(shares * price),
    state: 'sourced',
    source: {
      doc: `${Q3} · Cover page`,
      lines,
      hit: all(lines),
      build: [
        { label: 'Shares outstanding, millions', value: shares, digits: shares % 1 ? 3 : 0 },
        { label: `× Close, ${PRICE_DATE}, Nasdaq.com ($)`, value: price, digits: 2 },
        { label: 'Market cap, $M', value: shares * price, digits: 1 },
      ],
    },
  };
};

/** EV = market cap + debt + preferred − cash, all as of Sep 30, 2026. */
const ev = (capM: number, cash: [string, number], debt: [string, number][], preferred?: [string, number], note?: string): Cell => {
  const debtM = debt.reduce((a, [, n]) => a + n, 0);
  const prefM = preferred?.[1] ?? 0;
  const value = capM + debtM + prefM - cash[1];
  const lines = [cash, ...debt, ...(preferred ? [preferred] : [])].map(([label, n]) => ({ label, value: n }));
  return {
    value: bn(value),
    state: note ? 'adjusted' : 'sourced',
    note,
    source: {
      doc: `${Q3} · Balance sheet${preferred ? ' and Liquidity' : ''} · $M`,
      lines,
      hit: all(lines),
      build: [
        { label: 'Market cap', value: capM, digits: 1 },
        { label: debt.length ? '+ Debt' : '+ Debt (none reported)', value: debtM },
        ...(preferred ? [{ label: '+ Preferred stock', value: prefM }] : []),
        { label: '− Cash and cash equivalents', value: cash[1] },
        { label: 'Enterprise value', value, digits: 1 },
      ],
    },
  };
};

const ebitda = (name: string, source: Source): Cell => ({
  value: bn(source.build![source.build!.length - 1].value),
  state: 'adjusted',
  source,
  note: `${their(name)} adjusted EBITDA as it reports it, from its Q3 2026 earnings release.`,
});

/** No adjusted EBITDA in the release: blank until the analyst picks the
 *  adjusted operating income line or enters a number. */
const noEbitda = (name: string, fy: number, ytd: number, prior: number): Cell => ({
  value: null,
  state: 'needs',
  source: {
    doc: RELEASE,
    lines: [{ label: 'Adjusted operating income, LTM', value: fy + ytd - prior }],
    hit: null,
    build: [
      { label: 'FY2025, Q4 2025 release', value: fy },
      { label: '+ Nine months 2026', value: ytd },
      { label: '− Nine months 2025', value: prior },
      { label: 'Adjusted operating income, LTM', value: fy + ytd - prior },
    ],
    reason: `${their(name)} release reports adjusted operating income, not adjusted EBITDA. Nothing is filled in until you pick a line or enter a number.`,
  },
});

// Market caps in $M, for EV.
const CAP = {
  TOST: 581 * 35.16,
  XYZ: (544.546 + 59.976) * 84.04,
  FISV: 532.04772 * 62.74,
  GPN: 264.63581 * 94.98,
  FOUR: 74.943944 * 42.79,
};

export const COMPANIES: Company[] = [
  {
    name: 'Toast',
    ticker: 'TOST',
    target: true,
    cells: {
      cap: cap([['Class A common stock', 519], ['Class B common stock', 62]], 35.16),
      ev: ev(CAP.TOST, ['Cash and cash equivalents', 1203], []),
      revenue: { value: bn(7152), state: 'sourced', source: ltm(`${Q3} · Income statement · $M`, 'Total revenue', '10-K', 6153, 5519, 4520) },
      ebitda: ebitda('Toast', ltm(RELEASE, 'Adjusted EBITDA', 'Q4 2025 release', 633, 640, 470)),
    },
  },
  {
    name: 'Block',
    ticker: 'XYZ',
    cells: {
      cap: cap([['Class A common stock', 544.546], ['Class B common stock', 59.976]], 84.04),
      ev: ev(CAP.XYZ, ['Cash and cash equivalents', 7859.314], [['Long-term debt (Note 12)', 5723.027]]),
      revenue: { value: bn(25646.4), state: 'sourced', source: ltm(`${Q3} · Income statement · $M`, 'Total net revenue', '10-K', 24193.7, 19393.9, 17941.2) },
      ebitda: ebitda('Block', ltm('8-K · Q3 2026 shareholder letter · Exhibit 99.1 · $M', 'Adjusted EBITDA', 'Q4 2025 letter', 3466.6, 3406.7, 2536.9)),
    },
  },
  {
    name: 'Fiserv',
    ticker: 'FISV',
    cells: {
      cap: cap([['Common stock', 532.04772]], 62.74),
      ev: ev(CAP.FISV, ['Cash and cash equivalents', 545], [
        ['Short-term and current maturities of long-term debt', 1254],
        ['Long-term debt', 25809],
      ]),
      revenue: { value: bn(20799), state: 'sourced', source: ltm(`${Q3} · Income statement · $M`, 'Total revenue', '10-K', 21193, 15515, 15909) },
      ebitda: noEbitda('Fiserv', 7398, 4482, 5689),
    },
  },
  {
    name: 'Global Payments',
    ticker: 'GPN',
    cells: {
      cap: cap([['Common stock', 264.63581]], 94.98),
      ev: ev(CAP.GPN, ['Cash and cash equivalents', 5570.261], [
        ['Current portion of long-term debt', 1455.324],
        ['Long-term debt', 21080.837],
      ]),
      revenue: {
        value: bn(11493.521),
        state: 'sourced',
        source: ltm(`${Q3} · Income statement · $M`, 'Revenues', '10-K', 7705.878, 9596.757, 5809.114),
        note: "Global Payments' revenue includes Worldpay from January 9, 2026, when the deal closed. The three months before that don't.",
      },
      ebitda: noEbitda('Global Payments', 4116.287, 3819.474, 3079.466),
    },
  },
  {
    name: 'Shift4',
    ticker: 'FOUR',
    cells: {
      cap: cap([['Class A common stock', 74.943944]], 42.79),
      ev: ev(
        CAP.FOUR,
        ['Cash and cash equivalents', 1242],
        [['Current portion of debt', 650], ['Long-term debt', 4833]],
        ['Preferred stock, liquidation preference', 1000],
        "Shift4's EV adds about $1.0 billion of preferred stock, from its Q3 2026 10-Q.",
      ),
      revenue: { value: bn(4924), state: 'sourced', source: ltm(`${Q3} · Income statement · $M`, 'Gross revenue', '10-K', 4180, 3735, 2991) },
      ebitda: ebitda('Shift4', (() => {
        const q: [string, number][] = [['Q4 2025', 304], ['Q1 2026', 234], ['Q2 2026', 284], ['Q3 2026', 310]];
        const lines = q.map(([p, n]) => ({ label: `Adjusted EBITDA, ${p}`, value: n }));
        return {
          doc: RELEASE,
          lines,
          hit: all(lines),
          build: [...q.map(([p, n], i) => ({ label: `${i ? '+ ' : ''}${p}`, value: n })), { label: 'LTM, four quarters', value: 1132 }],
        };
      })()),
    },
  },
];
