/** @jsxImportSource preact */
// The comps study's live pieces: one table, three ways in (Preact + Framer
// Motion, hydrated when it scrolls into view, like the money page).
//
// fill: the builder fills the table on its own, once, when it's mostly in
// view. Numbers land row by row, left to right; a row's multiples count up
// once their inputs are in; a number nothing could be traced to lands last,
// as an empty cell that asks for the analyst.
// trace: pick any number (arrow keys move between them, Enter opens) and the
// source panel shows the filing line it came from and how it's built.
// correct: the same, plus fixing a number. Pick another line or enter one,
// and the multiples, the median and the mean count to their new values.
//
// One easing for all of it, the site's. Under reduced motion nothing moves
// or counts: values are simply there.
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { Fragment } from 'preact';
import { AnimatePresence, LazyMotion, animate, domAnimation, m, useInView, useReducedMotion, type Transition } from 'framer-motion';
import { COLUMNS, COMPANIES, INPUTS, SAMPLE, type Cell, type Input } from './data';

type Piece = 'fill' | 'trace' | 'correct';
type Pos = { row: number; col: number };
type Rows = Record<Input, Cell>[];

const EASE = [0.2, 0.7, 0.2, 1] as const;
const MULTIPLES = [
  { id: 'evRevenue', label: 'EV / revenue', num: 'ev', den: 'revenue' },
  { id: 'evEbitda', label: 'EV / EBITDA', num: 'ev', den: 'ebitda' },
] as const;

const keyOf = (row: number, col: string) => `${row}.${col}`;
const fmt = (v: number, digits: number) => v.toFixed(digits);
const times = (v: number | null) => (v === null ? '—' : `${fmt(v, 1)}x`);
const ratio = (num: number | null, den: number | null) => (num === null || den === null || den <= 0 ? null : num / den);
const peers = (rows: Rows) => rows.filter((_, i) => !COMPANIES[i].target);
const mean = (vs: number[]) => (vs.length ? vs.reduce((a, b) => a + b, 0) / vs.length : null);
const median = (vs: number[]) => {
  if (!vs.length) return null;
  const s = [...vs].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};
const multiplesOf = (rows: Rows) =>
  MULTIPLES.map((mu) => {
    const each = rows.map((r) => ratio(r[mu.num].value, r[mu.den].value));
    const known = peers(rows)
      .map((r) => ratio(r[mu.num].value, r[mu.den].value))
      .filter((v): v is number => v !== null);
    return { ...mu, each, median: median(known), mean: mean(known) };
  });

// Footnotes in the order their numbers appear, the way a pitch book has them.
const notesOf = (rows: Rows) =>
  rows.flatMap((r, row) => INPUTS.filter((col) => r[col].note).map((col) => ({ key: keyOf(row, col), text: r[col].note! })));

const STATE_TEXT = { sourced: 'sourced from a filing', adjusted: 'adjusted', needs: 'needs you, no line found', yours: 'set by you' };

/** A number that counts from where it was to where it is. It mounts at its
 *  value, unless `from` says where to count from. The text is only ever
 *  written here, never re-rendered by Preact, so the two can't disagree; a
 *  layout effect, so a jump (reduced motion, no change) lands before paint. */
function Count({ value, digits, suffix = '', from, reduce }: { value: number | null; digits: number; suffix?: string; from?: number; reduce: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  const text = (v: number | null) => (v === null ? '—' : fmt(v, digits) + suffix);
  const first = useRef(text(from ?? value));
  const last = useRef<number | null>(from ?? value);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const start = last.current ?? 0;
    last.current = value;
    if (value === null || reduce || start === value) {
      el.textContent = text(value);
      return;
    }
    const run = animate(start, value, { duration: 0.5, ease: EASE, onUpdate: (v) => (el.textContent = text(v)) });
    return () => run.stop();
  }, [value, reduce]);
  return <span ref={ref}>{first.current}</span>;
}

/** A light tint over a cell that just changed, fading over 1.2s. */
const Flash = ({ at, reduce }: { at?: number; reduce: boolean }) =>
  at && !reduce ? (
    <m.span key={at} class="flash" aria-hidden="true" initial={{ opacity: 1 }} animate={{ opacity: 0 }} transition={{ duration: 1.2, ease: EASE }} />
  ) : null;

function usePhone() {
  const [phone, setPhone] = useState(false);
  useEffect(() => {
    const q = matchMedia('(max-width: 639.98px)');
    const set = () => setPhone(q.matches);
    set();
    q.addEventListener('change', set);
    return () => q.removeEventListener('change', set);
  }, []);
  return phone;
}

export default function CompsBuilder({ piece }: { piece: Piece }) {
  const reduce = useReducedMotion() ?? false;
  const phone = usePhone();
  const live = piece !== 'fill';
  const root = useRef<HTMLElement>(null);
  const inView = useInView(root, { once: true, amount: 0.6 });

  const [rows, setRows] = useState<Rows>(() => COMPANIES.map((c) => ({ ...c.cells })));
  // Which numbers have landed. All of them, except while the fill runs.
  const [landed, setLanded] = useState<Set<string> | null>(piece === 'fill' ? new Set() : null);
  const [sel, setSel] = useState<Pos | null>(null);
  const [focus, setFocus] = useState<Pos>({ row: 0, col: 0 });
  const [flash, setFlash] = useState<Record<string, number>>({});
  const [said, setSaid] = useState('');
  const buttons = useRef<(HTMLButtonElement | null)[][]>(COMPANIES.map(() => []));
  const timers = useRef<number[]>([]);
  // Whether the panel was empty before this pick: the first pick slides in,
  // a switch only crossfades.
  const opened = useRef(false);

  const isIn = (k: string) => !landed || landed.has(k);
  const multiples = multiplesOf(rows);
  const notes = notesOf(rows);
  const noteNo = (k: string) => notes.findIndex((n) => n.key === k) + 1;
  const t = (s: number, delay = 0): Transition => (reduce ? { duration: 0 } : { duration: s, delay, ease: EASE });

  // The fill: rows 300ms apart, numbers 40ms apart within a row, the
  // empty cells last.
  const fill = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    const all = COMPANIES.flatMap((_, r) => INPUTS.map((col) => keyOf(r, col)));
    if (reduce) {
      setLanded(new Set(all));
      setSaid(summaryText());
      return;
    }
    setLanded(new Set());
    setSaid('');
    const land = (k: string, at: number) => timers.current.push(window.setTimeout(() => setLanded((s) => new Set(s).add(k)), at));
    let at = 150;
    const blanks: string[] = [];
    rows.forEach((r, row) => {
      INPUTS.forEach((col, c) => (r[col].state === 'needs' ? blanks.push(keyOf(row, col)) : land(keyOf(row, col), at + c * 40)));
      at += 300;
    });
    at += 200;
    blanks.forEach((k) => land(k, at));
    timers.current.push(window.setTimeout(() => setSaid(summaryText()), at + 400));
  };
  useEffect(() => {
    if (piece === 'fill' && inView) fill();
  }, [inView]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const counts = { sourced: 0, adjusted: 0, yours: 0, needs: 0 };
  rows.forEach((r, row) => INPUTS.forEach((col) => isIn(keyOf(row, col)) && counts[r[col].state]++));
  function summaryText() {
    const c = { sourced: 0, adjusted: 0, needs: 0 };
    rows.forEach((r) => INPUTS.forEach((col) => r[col].state in c && c[r[col].state as keyof typeof c]++));
    return `Table filled. ${c.sourced} numbers sourced, ${c.adjusted} adjusted, ${c.needs} ${c.needs === 1 ? 'needs' : 'need'} you.`;
  }

  // Arrow keys move between the numbers; the table is one tab stop.
  const move = (to: Pos) => {
    const row = Math.max(0, Math.min(COMPANIES.length - 1, to.row));
    const col = Math.max(0, Math.min(INPUTS.length - 1, to.col));
    setFocus({ row, col });
    buttons.current[row][col]?.focus();
  };
  const onKey = (e: KeyboardEvent) => {
    const steps: Record<string, Pos> = {
      ArrowUp: { row: focus.row - 1, col: focus.col },
      ArrowDown: { row: focus.row + 1, col: focus.col },
      ArrowLeft: { row: focus.row, col: focus.col - 1 },
      ArrowRight: { row: focus.row, col: focus.col + 1 },
      Home: { row: focus.row, col: 0 },
      End: { row: focus.row, col: INPUTS.length - 1 },
    };
    if (steps[e.key]) {
      e.preventDefault();
      move(steps[e.key]);
    }
  };
  const pick = (pos: Pos) => {
    opened.current = sel === null;
    setFocus(pos);
    setSel(pos);
  };
  const close = () => {
    if (!sel) return;
    const back = sel;
    setSel(null);
    buttons.current[back.row][back.col]?.focus();
  };
  // Escape closes the source from anywhere in the piece (an entry's own
  // Escape only cancels the entry).
  const onEscape = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && sel) close();
  };

  // A fix: the number takes the analyst's value, the multiples, median and
  // mean recount, and one message says what moved.
  const fix = (pos: Pos, value: number, how: { line: number } | { typed: true }) => {
    const col = INPUTS[pos.col];
    const name = COMPANIES[pos.row].name;
    const cell = rows[pos.row][col];
    // Lowercase mid-sentence, acronyms (LTM, EV, EBITDA) as they are.
    const label = COLUMNS[col].label
      .split(' ')
      .map((w) => (/^[A-Z]{2,}/.test(w) ? w : w.toLowerCase()))
      .join(' ');
    const note =
      'line' in how
        ? `${name} ${label}: "${cell.source.lines[how.line].label}", picked by you from the ${cell.source.doc.split(' · ')[1]}.`
        : `${name} ${label}: entered by you.`;
    const next = rows.map((r, i) =>
      i === pos.row ? { ...r, [col]: { ...cell, value, state: 'yours' as const, note, source: { ...cell.source, hit: 'line' in how ? how.line : null } } } : r,
    );
    const before = multiplesOf(rows);
    const after = multiplesOf(next);
    const now = Date.now();
    const lit: Record<string, number> = { [keyOf(pos.row, col)]: now };
    const parts: string[] = [];
    after.forEach((mu, i) => {
      if (mu.each[pos.row] !== before[i].each[pos.row]) {
        lit[keyOf(pos.row, mu.id)] = now;
        parts.push(`${name} ${mu.label} is now ${times(mu.each[pos.row])}.`);
      }
      for (const stat of ['median', 'mean'] as const) {
        if (mu[stat] !== before[i][stat]) {
          lit[`${stat}.${mu.id}`] = now;
          parts.push(`Peer ${stat} ${mu.label} moved from ${times(before[i][stat])} to ${times(mu[stat])}.`);
        }
      }
    });
    setRows(next);
    setFlash(lit);
    // The entry or the line picked is gone; focus goes back to the number.
    requestAnimationFrame(() => buttons.current[pos.row][pos.col]?.focus());
    setSaid(parts.join(' ') || `${name} ${label} set. No multiple changed.`);
  };
  const startOver = () => {
    setRows(COMPANIES.map((c) => ({ ...c.cells })));
    setSel(null);
    setFlash({});
    setSaid('The table is back to how the builder filled it.');
  };

  const numberCell = (row: number, col: Input, c: number) => {
    const k = keyOf(row, col);
    const cell = rows[row][col];
    const shown = isIn(k);
    const no = noteNo(k);
    const value = cell.value === null ? null : fmt(cell.value, COLUMNS[col].digits);
    const face =
      cell.state === 'needs' ? (
        <span class="needs">Needs you</span>
      ) : (
        <>
          {value}
          {no > 0 && <sup>{no}</sup>}
        </>
      );
    const body = !shown ? null : (
      <AnimatePresence mode="wait" initial={piece === 'fill' && !reduce}>
        <m.span key={cell.state} class="face" initial={{ opacity: 0, y: piece === 'fill' ? 6 : 0 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={t(piece === 'fill' ? 0.32 : 0.12)}>
          {face}
        </m.span>
      </AnimatePresence>
    );
    const name = `${COMPANIES[row].name} ${COLUMNS[col].label}: ${value ?? 'blank'}, ${STATE_TEXT[cell.state]}${no ? `, footnote ${no}` : ''}`;
    return (
      <td class="n" key={col}>
        {live ? (
          <button
            type="button"
            ref={(el) => {
              buttons.current[row][c] = el;
            }}
            class="cell"
            tabIndex={focus.row === row && focus.col === c ? 0 : -1}
            aria-label={name}
            aria-pressed={sel?.row === row && sel.col === c}
            onClick={() => pick({ row, col: c })}
            onFocus={() => setFocus({ row, col: c })}
          >
            {body}
            <Flash at={flash[k]} reduce={reduce} />
          </button>
        ) : (
          <span class="cell">{body}</span>
        )}
      </td>
    );
  };

  const panel = sel && <Panel key={keyOf(sel.row, INPUTS[sel.col])} pos={sel} rows={rows} noteNo={noteNo} piece={piece} fromEmpty={opened.current} reduce={reduce} t={t} onFix={fix} onClose={close} />;

  return (
    <LazyMotion features={domAnimation} strict>
      <section ref={root} onKeyDown={live ? onEscape : undefined} class={`comps comps-${piece}`} aria-label={piece === 'fill' ? 'The builder filling the table' : piece === 'trace' ? 'Tracing a number to its filing' : 'Correcting a number'}>
        <div class="app">
          <div class="main">
            <div class="head">
              <div>
                <p class="eyebrow">
                  Trading comps · LTM to Sep 30, 2026 · prices as of [date]
                  {SAMPLE && <span class="sample"> · sample numbers, not real</span>}
                </p>
                <p class="title">Toast, Inc. and four peers</p>
              </div>
              <ul class="summary" aria-hidden="true">
                <li><b><Count value={counts.sourced} digits={0} reduce={reduce} /></b> sourced</li>
                <li><b><Count value={counts.adjusted} digits={0} reduce={reduce} /></b> adjusted</li>
                {counts.yours > 0 && <li><b><Count value={counts.yours} digits={0} from={0} reduce={reduce} /></b> by you</li>}
                <li class={counts.needs ? 'warn' : ''}><b><Count value={counts.needs} digits={0} reduce={reduce} /></b> needs you</li>
              </ul>
            </div>

            <div class="scroll">
              <table onKeyDown={live ? onKey : undefined}>
                <caption class="visually-hidden">
                  Comps for Toast and four peers, in billions of dollars.{live && ' Use the arrow keys to move between numbers, and Enter to open one.'}
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Company</th>
                    {INPUTS.map((col) => (
                      <th scope="col" key={col}>
                        {COLUMNS[col].label}
                        <span class="unit">$bn</span>
                      </th>
                    ))}
                    {MULTIPLES.map((mu) => (
                      <th scope="col" key={mu.id}>{mu.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {COMPANIES.map((co, row) => (
                    <Fragment key={co.ticker}>
                      <tr class={co.target ? 'target' : undefined}>
                        <th scope="row" class="co">
                          {co.name}
                          <small>{co.ticker}</small>
                        </th>
                        {INPUTS.map((col, c) => numberCell(row, col, c))}
                        {multiples.map((mu) => {
                          const k = keyOf(row, mu.id);
                          const ready = isIn(keyOf(row, mu.num)) && isIn(keyOf(row, mu.den));
                          return (
                            <td class="n multiple" key={mu.id}>
                              {ready && <Count value={mu.each[row]} digits={1} suffix="x" from={piece === 'fill' ? 0 : undefined} reduce={reduce} />}
                              <Flash at={flash[k]} reduce={reduce} />
                            </td>
                          );
                        })}
                      </tr>
                      {phone && sel?.row === row && (
                        <tr class="push">
                          <td colSpan={7}>
                            <m.div class="push-in" initial={reduce ? false : { height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} transition={t(0.32)}>
                              {panel}
                            </m.div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
                <tfoot>
                  {(['median', 'mean'] as const).map((stat) => (
                    <tr key={stat}>
                      <th scope="row">Peer {stat}</th>
                      <td colSpan={4} />
                      {multiples.map((mu) => {
                        const ready = !landed || COMPANIES.every((_, row) => isIn(keyOf(row, mu.num)) && isIn(keyOf(row, mu.den)));
                        return (
                          <td class="n multiple" key={mu.id}>
                            {ready && <Count value={mu[stat]} digits={1} suffix="x" from={piece === 'fill' ? 0 : undefined} reduce={reduce} />}
                            <Flash at={flash[`${stat}.${mu.id}`]} reduce={reduce} />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tfoot>
              </table>
            </div>

            <ol class="notes">
              {/* The fill keeps every note's room from the start, so the
                  page below never moves; a note fades in with its number.
                  A fix adds its note with a push-down. */}
              <AnimatePresence initial={false}>
                {notes.map((n, i) =>
                  piece === 'fill' ? (
                    <m.li key={n.key} initial={false} animate={{ opacity: isIn(n.key) ? 1 : 0 }} transition={t(0.32)}>
                      <span class="no">{i + 1}</span> {n.text}
                    </m.li>
                  ) : isIn(n.key) ? (
                    <m.li key={n.key + n.text} initial={reduce ? false : { height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={t(0.32)}>
                      <span class="no">{i + 1}</span> {n.text}
                    </m.li>
                  ) : null,
                )}
              </AnimatePresence>
            </ol>

            <div class="foot">
              <ul class="legend">
                <li><span class="mono">12.3</span> sourced from a filing</li>
                <li><span class="mono">12.3<sup>1</sup></span> adjusted or set by you, footnoted</li>
                <li><span class="needs">Needs you</span> no line found, left blank</li>
              </ul>
              {piece === 'fill' && (
                <button type="button" class="btn" onClick={fill}>Fill again</button>
              )}
              {piece === 'correct' && (
                <button type="button" class="btn" onClick={startOver}>Start over</button>
              )}
            </div>
          </div>

          {live && !phone && (
            <aside class="panel" aria-label="Source">
              <AnimatePresence mode="wait" initial={false}>
                {panel || (
                  <m.p key="empty" class="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={t(0.12)}>
                    {piece === 'correct' ? "Pick a number to check or fix it. Fiserv's adjusted EBITDA needs you." : 'Pick a number to see where it came from.'}
                  </m.p>
                )}
              </AnimatePresence>
            </aside>
          )}
        </div>
        <p class="visually-hidden" aria-live="polite">{said}</p>
      </section>
    </LazyMotion>
  );
}

type PanelProps = {
  pos: Pos;
  rows: Rows;
  noteNo: (k: string) => number;
  piece: Piece;
  fromEmpty: boolean;
  reduce: boolean;
  t: (s: number, delay?: number) => Transition;
  onFix: (pos: Pos, value: number, how: { line: number } | { typed: true }) => void;
  onClose: () => void;
};

/** Where a number came from: the filing's lines with the one it came from
 *  highlighted, how it's built, and (when correcting) the ways to fix it. */
function Panel({ pos, rows, noteNo, piece, fromEmpty, reduce, t, onFix, onClose }: PanelProps) {
  const col = INPUTS[pos.col];
  const cell = rows[pos.row][col];
  const { source } = cell;
  const no = noteNo(keyOf(pos.row, col));
  const [mode, setMode] = useState<'look' | 'line' | 'type'>(cell.state === 'needs' && piece === 'correct' ? 'line' : 'look');
  const [typed, setTyped] = useState('');
  const [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (mode === 'type') input.current?.focus();
  }, [mode]);

  const submit = (e: Event) => {
    e.preventDefault();
    const v = Number(typed);
    if (!typed.trim() || !Number.isFinite(v) || v <= 0) {
      setError('Enter a number in billions of dollars, like 8.1.');
      return;
    }
    onFix(pos, v, { typed: true });
    setMode('look');
  };

  return (
    <m.div class="source" initial={reduce ? false : { opacity: 0, x: fromEmpty ? 16 : 0 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={t(fromEmpty ? 0.28 : 0.18)}>
      <div>
        <p class="eyebrow">{cell.state === 'needs' ? <span class="warn">Needs you</span> : no ? `Source · footnote ${no}` : 'Source'}</p>
        <p class="what">
          {COMPANIES[pos.row].name} {COLUMNS[col].label.replace('LTM ', '')}
          {cell.value !== null && <span class="mono"> · {fmt(cell.value, COLUMNS[col].digits)}</span>}
        </p>
      </div>
      {source.reason && cell.state === 'needs' && <p class="reason">{source.reason}</p>}
      <div class="doc">
        <p class="eyebrow">{source.doc}</p>
        {source.lines.map((line, i) => {
          const hit = source.hit === i;
          const inner = (
            <>
              {hit && <m.span class="hl" aria-hidden="true" initial={reduce ? false : { scaleX: 0 }} animate={{ scaleX: 1 }} transition={t(0.36, 0.12)} />}
              <span>{line.label}</span>
              <span class="mono">{fmt(line.value, 2)}</span>
            </>
          );
          return mode === 'line' && piece === 'correct' ? (
            <button type="button" class={`line pickable${hit ? ' hit' : ''}`} key={line.label} onClick={() => (onFix(pos, line.value, { line: i }), setMode('look'))} aria-label={`Use ${line.label}, ${fmt(line.value, 2)}`}>
              {inner}
            </button>
          ) : (
            <div class={`line${hit ? ' hit' : ''}`} key={line.label} aria-current={hit ? 'true' : undefined}>
              {inner}
            </div>
          );
        })}
      </div>
      {source.build && cell.state !== 'yours' && (
        <div>
          <p class="eyebrow">How it's built</p>
          <div class="build">
            {source.build.map((b, i) => (
              <m.div key={b.label} class={i === source.build!.length - 1 ? 'total' : undefined} initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={t(0.2, 0.12 + i * 0.06)}>
                <span>{b.label}</span>
                <span class="mono">{fmt(b.value, 2)}</span>
              </m.div>
            ))}
          </div>
        </div>
      )}
      {mode === 'type' && (
        <form class="enter" onSubmit={submit}>
          <label for="comps-value">{COLUMNS[col].label}, $bn</label>
          <div>
            <input
              id="comps-value"
              ref={input}
              inputMode="decimal"
              autocomplete="off"
              value={typed}
              aria-invalid={error ? 'true' : undefined}
              aria-describedby={error ? 'comps-error' : undefined}
              onInput={(e) => (setTyped(e.currentTarget.value), setError(''))}
              onKeyDown={(e) => e.key === 'Escape' && (e.stopPropagation(), setMode('look'))}
            />
            <button type="submit" class="btn primary">Apply</button>
            <button type="button" class="btn" onClick={() => setMode('look')}>Cancel</button>
          </div>
          {error && <p id="comps-error" class="error">{error}</p>}
        </form>
      )}
      <div class="actions">
        {piece === 'correct' && mode !== 'type' && (
          <>
            {cell.state !== 'needs' && <button type="button" class="btn primary" onClick={onClose}>Keep</button>}
            <button type="button" class="btn" aria-pressed={mode === 'line'} onClick={() => setMode(mode === 'line' ? 'look' : 'line')}>Use another line</button>
            <button type="button" class="btn" onClick={() => setMode('type')}>Enter a number</button>
          </>
        )}
        {piece === 'trace' && <button type="button" class="btn" onClick={onClose}>Close</button>}
      </div>
    </m.div>
  );
}
