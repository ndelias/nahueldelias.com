/** @jsxImportSource preact */
// The money page's ledger, as a small working model (Preact + Framer Motion,
// hydrated when it scrolls into view). Pick how much credit the buyer has,
// buy one license, and watch what the real system does: credit is taken
// first, in the sale's own transaction; a card pays the rest; the sale
// settles from an event, never by waiting on a webhook; the license is
// granted only then. A second spend of the same sale is refused by the
// database. A declined card ends the sale and hands back the exact credit,
// to the pool it came from, in the same transaction.
//
// Amounts are an example (the $69 license and $150 of credit from the
// Purchasing and Wallet pages), kept in signed cents as the ledger keeps them.
import { useEffect, useRef, useState } from 'preact/hooks';
import { AnimatePresence, LazyMotion, animate, domAnimation, m, useReducedMotion } from 'framer-motion';

type Kind = 'Grant' | 'Spend' | 'Reversal';
type Status = 'Settled' | 'Pending' | 'Reversed';
type Entry = { id: number; kind: Kind; cents: number; ref: string; status: Status };
type Event = { id: number; text: string; tone?: 'ok' | 'no' | 'charge' };

const PRICE = 6900; // the license with the fee, as on the Purchasing page
const SCENARIOS = [
  { id: 'full', label: 'Credit covers it', grant: 15000 },
  { id: 'part', label: 'Credit covers part', grant: 2500 },
  { id: 'none', label: 'No credit', grant: 0 },
] as const;
type ScenarioId = (typeof SCENARIOS)[number]['id'];

const money = (cents: number, sign = false) => {
  const s = (Math.abs(cents) / 100).toFixed(2);
  return `${sign ? (cents < 0 ? '-' : cents > 0 ? '+' : '') : cents < 0 ? '-' : ''}$${s}`;
};

let uid = 0;
const next = () => ++uid;

export default function LedgerSim() {
  const reduce = useReducedMotion();
  const [scenario, setScenario] = useState<ScenarioId>('part');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [sale, setSale] = useState<{ n: number; state: 'idle' | 'running' | 'settled' | 'cancelled' }>({ n: 1041, state: 'idle' });
  const timers = useRef<number[]>([]);

  const grant = SCENARIOS.find((s) => s.id === scenario)!.grant;
  const balance = entries.reduce((sum, e) => sum + e.cents, 0);
  // The quote is made from the credit the buyer starts with, so it still
  // reads right after the sale has spent it.
  const fromCredit = Math.min(grant, PRICE);

  // The balance counts up and down instead of jumping.
  const shown = useRef<HTMLSpanElement>(null);
  const last = useRef(0);
  useEffect(() => {
    const el = shown.current;
    if (!el) return;
    if (reduce) {
      el.textContent = money(balance);
      last.current = balance;
      return;
    }
    const controls = animate(last.current, balance, {
      duration: 0.6,
      ease: [0.2, 0.7, 0.2, 1],
      onUpdate: (v) => (el.textContent = money(Math.round(v))),
    });
    last.current = balance;
    return () => controls.stop();
  }, [balance, reduce]);

  const clear = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  const reset = (id: ScenarioId = scenario) => {
    clear();
    const g = SCENARIOS.find((s) => s.id === id)!.grant;
    setEntries(g ? [{ id: next(), kind: 'Grant', cents: g, ref: 'Prize credit, from an admin', status: 'Settled' }] : []);
    setEvents([]);
    setSale((s) => ({ n: s.n + 1, state: 'idle' }));
  };
  useEffect(() => {
    reset(scenario);
    return clear;
  }, [scenario]);

  // Steps play one after another, or all at once under reduced motion.
  const play = (steps: (() => void)[]) => {
    clear();
    steps.forEach((step, i) => {
      if (reduce) step();
      else timers.current.push(window.setTimeout(step, i * 750));
    });
  };
  const say = (text: string, tone?: Event['tone']) => setEvents((list) => [...list, { id: next(), text, tone }]);
  const mark = (ref: string, status: Status) => setEntries((list) => list.map((e) => (e.ref === ref && e.kind === 'Spend' ? { ...e, status } : e)));

  const buy = (declined = false) => {
    const ref = `Sale ${sale.n}`;
    const credit = Math.min(balance, PRICE);
    const card = PRICE - credit;
    setSale((s) => ({ ...s, state: 'running' }));
    setEvents([]);
    const steps: (() => void)[] = [() => say(`${ref} opened for ${money(PRICE)}`)];
    if (credit) {
      steps.push(() => {
        setEntries((list) => [...list, { id: next(), kind: 'Spend', cents: -credit, ref, status: 'Pending' }]);
        say(`${money(credit)} of credit taken first, in the sale's own transaction`);
      });
    }
    if (card && declined) {
      steps.push(() => say(`Card declined for ${money(card)}`, 'no'));
      steps.push(() => {
        if (credit) {
          mark(ref, 'Reversed');
          setEntries((list) => [...list, { id: next(), kind: 'Reversal', cents: credit, ref, status: 'Settled' }]);
          say(`Sale ended. ${money(credit)} handed back to the pool it came from, in the same transaction`, 'ok');
        } else say('Sale ended. Nothing was taken, so nothing to hand back', 'ok');
        setSale((s) => ({ ...s, state: 'cancelled' }));
      });
    } else {
      if (card) {
        steps.push(() => say(`Card charged ${money(card)} on Stripe`, 'charge'));
        steps.push(() => say("Stripe's event arrives, and the sale settles from it"));
      } else steps.push(() => say('No charge to wait for, so the sale settles as its own event'));
      steps.push(() => {
        if (credit) mark(ref, 'Settled');
        say('Settled once. Only now is the license granted', 'ok');
        setSale((s) => ({ ...s, state: 'settled' }));
      });
    }
    play(steps);
  };

  const spendTwice = () => {
    const ref = `Sale ${sale.n}`;
    say(`Second spend for ${ref} refused by the database. One spend per sale, by a unique index`, 'no');
  };

  const running = sale.state === 'running';
  const done = sale.state === 'settled' || sale.state === 'cancelled';
  const spent = entries.some((e) => e.kind === 'Spend' && e.ref === `Sale ${sale.n}`);
  const t = reduce ? { duration: 0 } : { duration: 0.35, ease: [0.2, 0.7, 0.2, 1] as const };

  // LazyMotion with the DOM animation features only: Framer Motion's
  // smaller build (no drag or layout animation, which this doesn't use).
  return (
    <LazyMotion features={domAnimation} strict>
    <div class="sim">
      <div class="sim-controls" role="group" aria-label="The buyer's credit">
        {SCENARIOS.map((s) => (
          <button type="button" class="chip" aria-pressed={scenario === s.id} disabled={running} onClick={() => setScenario(s.id)}>
            {s.label}
          </button>
        ))}
      </div>

      <div class="sim-grid">
        <section class="card balance" aria-label="Platform credit">
          <p class="eyebrow">Platform credit</p>
          <p class="big num">
            <span ref={shown}>{money(grant)}</span>
          </p>
          <p class="small muted">Spendable at checkout. It can't be withdrawn.</p>
          <dl class="mini">
            <div><dt>License</dt><dd class="num">{money(PRICE)}</dd></div>
            <div><dt>From credit</dt><dd class="num">{money(fromCredit)}</dd></div>
            <div><dt>From card</dt><dd class="num">{money(PRICE - fromCredit)}</dd></div>
          </dl>
          <div class="actions">
            <button type="button" class="btn primary" disabled={running || done} onClick={() => buy(false)}>Buy the license</button>
            {PRICE > fromCredit && (
              <button type="button" class="btn" disabled={running || done} onClick={() => buy(true)}>Buy, card declined</button>
            )}
            <button type="button" class="btn" disabled={!spent || running} onClick={spendTwice}>Spend it twice</button>
            <button type="button" class="btn ghost" disabled={running} onClick={() => reset()}>Reset</button>
          </div>
        </section>

        <section class="card ledger" aria-label="Ledger entries">
          <p class="eyebrow">Ledger <span class="muted">· append-only, signed cents</span></p>
          <table>
            <thead>
              <tr><th scope="col">Entry</th><th scope="col">For</th><th scope="col" class="r">Amount</th><th scope="col" class="r">Status</th></tr>
            </thead>
            <tbody>
              <AnimatePresence initial={false}>
                {entries.map((e) => (
                  <m.tr key={e.id} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={t}>
                    <td>{e.kind}</td>
                    <td class="muted">{e.ref}</td>
                    <td class={`r num ${e.cents < 0 ? 'neg' : 'pos'}`}>{money(e.cents, true)}</td>
                    <td class="r"><span class={`pill ${e.status.toLowerCase()}`}>{e.status}</span></td>
                  </m.tr>
                ))}
              </AnimatePresence>
              {!entries.length && (
                <tr><td colSpan={4} class="muted empty">No entries yet. Without credit, the card pays it all.</td></tr>
              )}
            </tbody>
            <tfoot>
              <tr><th scope="row" colSpan={2}>Balance, the sum of the entries</th><td colSpan={2} class="r num">{money(balance)}</td></tr>
            </tfoot>
          </table>
        </section>

        <section class="card log" aria-label="What happened">
          <p class="eyebrow">Events</p>
          <ol aria-live="polite">
            <AnimatePresence initial={false}>
              {events.map((e) => (
                <m.li key={e.id} class={e.tone} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={t}>
                  {e.text}
                </m.li>
              ))}
            </AnimatePresence>
          </ol>
          {!events.length && <p class="muted small">Buy the license to see the steps.</p>}
          <p class="small muted reconcile">A reconcile job runs every 15 minutes and settles anything an event missed.</p>
        </section>
      </div>
    </div>
    </LazyMotion>
  );
}
