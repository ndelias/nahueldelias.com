/** @jsxImportSource preact */
// The money page's map of who gets paid (Preact + Framer Motion, hydrated
// when it scrolls into view). One license sale, left to right: the buyer,
// checkout, the sale settling, then the split out to everyone with a share.
// A second lane follows the remix after release, when every stream pays
// everyone upstream. Cards rise in turn as the map comes into view, and a
// coin runs along each connector while it's on screen. Under reduced motion
// everything is simply there, and no coin runs.
import type { ComponentChildren } from 'preact';
import { LazyMotion, domAnimation, m, useReducedMotion } from 'framer-motion';

type Payee = { who: string; side: string; note: string; pill: string; tone: 'paid' | 'held' | 'fee' };

interface Props {
  payees: Payee[];
}

const EASE = [0.2, 0.7, 0.2, 1] as const;

function Coin({ vertical = false, delay = 0 }: { vertical?: boolean; delay?: number }) {
  const reduce = useReducedMotion();
  if (reduce) return null;
  return (
    <m.span
      class="coin"
      aria-hidden="true"
      initial={vertical ? { top: '0%', opacity: 0 } : { left: '0%', opacity: 0 }}
      animate={vertical ? { top: ['0%', '100%'], opacity: [0, 1, 1, 0] } : { left: ['0%', '100%'], opacity: [0, 1, 1, 0] }}
      transition={{ duration: 1.6, ease: 'easeInOut', repeat: Infinity, repeatDelay: 0.9, delay }}
    />
  );
}

function Step({ i, eyebrow, title, children }: { i: number; eyebrow: string; title: string; children: ComponentChildren }) {
  const reduce = useReducedMotion();
  return (
    <m.li
      class="node"
      initial={reduce ? false : { opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.6 }}
      transition={{ duration: 0.5, ease: EASE, delay: reduce ? 0 : i * 0.12 }}
    >
      <p class="eyebrow">{eyebrow}</p>
      <p class="node-title">{title}</p>
      <p class="small muted">{children}</p>
    </m.li>
  );
}

export default function MoneyMap({ payees }: Props) {
  const reduce = useReducedMotion();
  return (
    <LazyMotion features={domAnimation} strict>
    <div class="map">
      <ol class="lane" aria-label="One license sale">
        <Step i={0} eyebrow="01 · Buyer" title="Buys a remix license">Credit first, then a card for the rest.</Step>
        <li class="link" aria-hidden="true"><Coin /></li>
        <Step i={1} eyebrow="02 · Checkout" title="One sale, one transaction">Credit is taken before the card is charged.</Step>
        <li class="link" aria-hidden="true"><Coin delay={0.5} /></li>
        <Step i={2} eyebrow="03 · Settles" title="Exactly once">Then the license is granted, and the money moves.</Step>
      </ol>

      <div class="fan" aria-hidden="true"><Coin vertical delay={1} /></div>

      <ul class="payees" aria-label="Who gets paid from the sale">
        {payees.map((p, i) => (
          <m.li
            class={`payee ${p.tone}`}
            initial={reduce ? false : { opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.5 }}
            transition={{ duration: 0.5, ease: EASE, delay: reduce ? 0 : 0.2 + i * 0.1 }}
          >
            <div class="payee-top">
              <p class="eyebrow">{p.side}</p>
              <span class={`pill ${p.tone}`}>{p.pill}</span>
            </div>
            <p class="node-title">{p.who}</p>
            <p class="small muted">{p.note}</p>
          </m.li>
        ))}
      </ul>

      <p class="lane-label eyebrow">After the remix is released</p>
      <ol class="lane" aria-label="After the remix is released">
        <Step i={0} eyebrow="Release" title="Remix out in stores">Delivered with the license it was made under.</Step>
        <li class="link" aria-hidden="true"><Coin delay={0.3} /></li>
        <Step i={1} eyebrow="Streams and sales" title="Royalties come in">Each sale and stream is a payment to split.</Step>
        <li class="link" aria-hidden="true"><Coin delay={0.8} /></li>
        <Step i={2} eyebrow="Upstream" title="Everyone in the chain">The remixer, the first remixer and the original, each by the grant the remix inherited, and vers1ons takes its percentage.</Step>
      </ol>
    </div>
    </LazyMotion>
  );
}
