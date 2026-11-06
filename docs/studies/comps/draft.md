# Comps study: approved drafts

Working copy for the fintech concept study, moved into the MDX entry at the
ship step. Approved by Nahuel on 2026-11-04 unless marked otherwise.

## Note at the top

A concept I designed and built on my own. I haven't built comps myself. What I know about the work comes from training guides, analyst forums, and public case studies, and I've listed what I'm assuming. The numbers come from public filings.

## The problem

Heading (a, picked by default, he can swap for b): Checking an AI-built comps table takes as long as building one.
Heading (b): The slow part of comps is checking the numbers.

Comps compare a company with its peers. An analyst picks the peers, pulls each one's numbers from its filings, adjusts them so they line up, and works out the multiples. By hand, ten companies take hours. AI tools can fill the same table in seconds. But a VP won't send a number to a client without knowing where it came from, so the analyst still checks each one against the filing. That check is the slow part, and it's the part I wanted to design for.

## Who it's for

Two people touch a comps table before a client sees it. The analyst builds it, usually in their first or second year. A VP or associate reviews it before it goes into a pitch book or a research note. The analyst needs to fill it fast. The VP needs to trust it without redoing it.

## What I'm assuming

- Reviewers spot-check numbers against the filings. They don't rebuild the table.
- Most wrong numbers come from definitions, like GAAP versus non-GAAP or periods that don't line up, more than from typos. This comes from forum posts and a CFA Institute article, not from data.
- With AI, the slow part is checking the table, not filling it. Bankers in a public case study say AI gets them most of the way there.
- Analysts would rather fix a number where they find it than leave the tool and fix it in Excel.

## The journey (agreed 2026-11-04, notes not copy)

Analyst: the ask (VP wants comps for a pitch, analyst names the company) →
peers (AI suggests them with a reason each, e.g. named as a competitor in the
10-K; analyst removes or adds) → fill (row by row; each number is sourced,
adjusted, or needs you) → check (flagged numbers first; a number opens the
filing at its line, adjustments under it) → correct (change the number or pick
another line; multiples and medians recalculate; logged with who and why,
becomes a footnote) → send to the VP with sources and footnotes.

VP: open (summary like "3 numbers corrected, 2 adjusted, all sourced") →
spot-check any number in the same source panel → approve or comment.

Mindless when it works: the VP checks any number without asking the analyst.

## The decision (draft, chosen 2026-11-04: blank over guessed)

- intro: The AI can't always trace a number to a filing. I had to decide what the table shows when that happens.
- chose: Leave the cell blank and ask the analyst.
- rejected: Fill every cell with a best guess and a confidence score.
- cost: The first table looks less finished, and the AI seems to do less. Analysts fill some cells by hand. In return, every number on the screen has a source.

## Screens and live pieces (agreed 2026-11-04)

Screens: the comps table (every number sourced, adjusted, or needs you),
the source panel, the peer picker, and the VP's view.

Live pieces, sharing one table component: the fill, the trace, and the
correction. The peer picker and the VP's view ship as plain HTML, no JS.

Look (decided 2026-11-05): the site's tokens, the money page's approach.
Instrument Sans labels, DM Mono numbers with tabular digits, no accent blue
in the states. Sourced = plain ink, adjusted = a small marker, needs you =
outlined in the warning color.

Source panel (decided 2026-11-05): beside the table on desktop, a push-down
under the row on phones. Sketch: docs/studies/comps/sketch/index.html
(sample numbers, not shipped).

Data (agreed 2026-11-05): payments. PayPal, Block, Fiserv, Global Payments,
Shift4, and Toast, all December year-ends. Every number from their 10-K and
10-Q filings, checked against EDGAR, with share prices dated. The comps
are for Toast (chosen 2026-11-05), so the other five are its peers.

## What the filings say about peers (checked 2026-11-05)

- Toast's 10-K (FY2025) names no competitors. It says it competes with
  "cloud-based point of sale platforms, legacy point of sale platform payments
  solutions, and point technology providers". Assumption that it names Square
  and Clover was wrong.
- Toast's 2026 proxy (DEF 14A) pay peer group is software companies (Affirm,
  HubSpot, DoorDash, Datadog, and others), not payments. That group is for
  executive pay, not valuation.
- Shift4's 10-K names Toast, Square, Fiserv, and Global Payments as competitors.
- Global Payments' 10-K lists Toast, Inc. among its competitors.
- Fiserv's 10-K describes Clover, a cloud-based POS, with "a strong presence
  in restaurant and retail".
- Block's 10-K describes Square Point of Sale. No mention of restaurants or Toast.
- PayPal's 10-K mentions an in-person point of sale app. No mention of
  restaurants or Toast. Weakest peer.

Decided 2026-11-05: the AI suggests PayPal with its weak reason, and the
analyst removes it in the peer picker. The table ends with four peers.

## Latest filings (as of 2026-11-05)

Q3 2026 10-Q filed: Toast (11-04), Fiserv (11-04), Block (11-03), PayPal (10-27).
Not yet filed: Shift4 and Global Payments (latest is Q2 2026). LTM periods
will differ unless the table waits or uses Q2 for everyone.

Decided 2026-11-05: wait for Q3, so every LTM ends 2026-09-30. Design the
table with empty numbers meanwhile. If Shift4 or Global Payments still hasn't
filed when the live pieces need data, use the latest for each and show each
row's period end.

EBITDA (decided 2026-11-05): each company's own adjusted EBITDA from its
earnings release, with its reconciliation shown in the source panel. A company
that doesn't report adjusted EBITDA gets a blank cell that asks the analyst.
To check: whether each peer reports it (Fiserv may report adjusted operating
income instead).

## Motion plan (agreed 2026-11-05)

All page motion uses the site's easing, cubic-bezier(0.2, 0.7, 0.2, 1).

The fill (about 2.4s in all)
- Starts on its own, once, when the table is mostly in view. A "Fill again"
  button replays it.
- Rows come in one at a time, 90ms apart. Each fades up 6px over 320ms.
- In a row, numbers land left to right, 40ms apart, as a fade.
- Multiples come last, counting up from zero over 500ms, once their inputs
  have landed.
- The needs-you cell's dashed outline fades in last. No shake, no bounce.
- The summary's counts tick up as cells land.

The trace
- The panel slides in 16px from the right and fades, 280ms.
- After 120ms, the highlight sweeps across the matching line (scaleX from the
  left, 360ms).
- The "How it's built" rows fade in 60ms apart.
- Picking another number crossfades the panel's content (180ms). The panel
  itself doesn't move.

The correction
- A filled needs-you cell goes from dashed to plain over 240ms.
- The multiple it feeds counts from the dash to its value over 500ms. The
  median and mean count from old to new.
- Changed cells get a light surface tint that fades over 1.2s.
- The footnote is added to the log with a push-down.

Reduced motion: no movement or counting. Values appear at once, the
highlight is static, and the fill shows the finished table.

Keyboard: arrow keys move between numbers (one tab stop for the table), Enter
opens the source, Escape closes it and returns focus to the number. In an
entry, Enter commits and Escape cancels. One polite live region announces
results, e.g. "Fiserv EV/EBITDA is now 9.8x. Peer median moved from 10.0x
to 9.9x."

## Section copy (approved 2026-11-05, in comps.mdx)

Who it's for, heading: The analyst builds it. The VP checks it.

The fill. Heading: The builder fills the table and leaves blanks it can't source.
When the analyst names the company, the builder fills the table one row at a time. Each number comes from a filing. When it can't find a line for a number, it leaves the cell blank and marks it Needs you. The multiples next to it stay empty too, so a missing number never turns into a wrong multiple.

The trace. Heading: Every number opens the line it came from.
Pick any number to see where it came from. The panel shows the filing, highlights the line, and shows how the number was built, like last year plus this year to date, minus the same months last year. A VP can check any number without asking the analyst.

The correction. Heading: Fixing a number updates everything that depends on it.
Fiserv's earnings release reports adjusted operating income, not adjusted EBITDA, so the builder left it blank. [To check against Fiserv's Q3 2026 release.] Pick another line or enter a number. The multiples, the median, and the mean count to their new values, and a footnote records that you set it.

The motion. Heading: How it moves.
Everything uses one easing curve, the same one as the rest of this site. Numbers fade up 6 pixels over a third of a second. Multiples count instead of jumping, so you can see which way they moved. The source panel slides in 16 pixels the first time and only crossfades after that, so switching between numbers doesn't feel like opening something new. A changed number gets a light tint that fades over a second. With reduced motion turned on, nothing moves or counts.

## Under the hood (outline, 2026-11-05, words only)

This part is a plan, not a built system. Only the demo on the page is built.

1. Data model: every number is a record, not a cell. Value, unit, period,
   company, which metric, its source (filing, section, line), how it's built
   from other records, its state, and who changed it and why. Multiples are
   worked out on the fly, never stored, so they can't drift from their inputs.
2. Tracing: GAAP numbers from the 10-K and 10-Q come from EDGAR's XBRL data,
   where each fact is tagged with its period and filing. Adjusted numbers come
   from the earnings release's reconciliation table, which isn't tagged
   (checked 2026-11-05: Toast's Q3 2026 Exhibit 99.1 has Adjusted EBITDA and
   no inline XBRL tags; only the 8-K cover is tagged). Each number keeps the exact place it was read from, so the
   panel can highlight it. A number without one doesn't enter the table.
3. Checking the AI: the model proposes, plain code checks. The cited line has
   to contain the number. LTM math has to add up. EV has to equal market cap
   plus debt minus cash. Units have to match (thousands vs millions). Where
   XBRL has the same fact, the two have to agree. Anything that fails becomes
   Needs you. An eval set of hand-checked tables measures how often a filled
   number is right and how many blanks it leaves.
4. What I'd build first (decided 2026-11-05): the trace, with no AI. Records,
   the source panel, and only XBRL numbers for one peer set. Then the AI reads
   earnings releases, under the checks.

## Under the hood copy (approved 2026-11-05, in comps.mdx)

Under the hood · Records. Heading: Every number is a record, not a cell.
Only the demo on this page is built. The rest of this section is how I'd build the real thing. Each number in the table is a record. It holds the value, the unit, the period, and the company. It also holds where it came from, how it's built from other numbers, its state, and who changed it and why. Multiples aren't stored. They're worked out from their inputs every time, so they can't drift.

Under the hood · Sources. Heading: Each number keeps the place it was read from.
Numbers from the 10-K and 10-Q come from EDGAR's XBRL data, where each fact is tagged with its period and filing. Adjusted EBITDA comes from the earnings release, and that table isn't tagged. Toast's Q3 2026 release has no tags at all, so the builder reads it like a page. Either way, each number keeps the exact place it was read from, so the panel can highlight it. A number without one stays blank.

Under the hood · Checks. Heading: The model suggests a number, and code checks it.
The AI reads the earnings release and suggests a number with its line. Plain code then checks it. The line has to contain the number. The twelve-month math has to add up. EV has to equal market cap plus debt minus cash. Units have to match, thousands or millions. Where XBRL has the same number, the two have to agree. If any check fails, the cell becomes Needs you. A set of tables I'd check by hand would measure how often a filled number is right and how many blanks the builder leaves.

Under the hood · First. Heading: I'd build the trace first, with no AI.
The first version would only use XBRL numbers for one set of peers, with records and the source panel. No model would fill anything. That proves the part people have to trust, and every number can be checked from day one. Then the AI comes in to read earnings releases, under the checks.

## Sources

- Wall Street Prep on calendarization: https://wallstreetprep.com/knowledge/calendarization
- Comps methodology guide: https://ryanoconnellfinance.com/comparable-companies-analysis/
- WSO, what it means to spread comps: https://www.wallstreetoasis.com/forum/investment-banking/what-does-it-mean-to-spread-comps
- WSO, hand spread vs. CapIQ: https://www.wallstreetoasis.com/forums/spreading-comps-hand-spread-vs-capiq-spread
- CFA Institute, analyst accounting mistakes: https://blogs.cfainstitute.org/investor/2015/05/12/the-top-five-accounting-mistakes-analysts-make
- Capital IQ data accuracy: https://u-pad.unimc.it/handle/11393/231921
- Rogo and Baird case study: https://rogo.com/customers/baird-investment-banking
- Toast 10-K FY2025: https://www.sec.gov/Archives/edgar/data/1650164/000165016426000057/tost-20251231.htm
- Toast DEF 14A 2026: https://www.sec.gov/Archives/edgar/data/1650164/000165016426000098/tost-20260423.htm
- Shift4 10-K FY2025: https://www.sec.gov/Archives/edgar/data/1794669/000179466926000010/four-20251231.htm
- Global Payments 10-K FY2025: https://www.sec.gov/Archives/edgar/data/1123360/000112336026000008/gpn-20251231.htm
- Fiserv 10-K FY2025: https://www.sec.gov/Archives/edgar/data/798354/000079835426000009/fi-20251231.htm
- Block 10-K FY2025: https://www.sec.gov/Archives/edgar/data/1512673/000162828026012254/xyz-20251231.htm
- PayPal 10-K FY2025: https://www.sec.gov/Archives/edgar/data/1633917/000163391726000024/pypl-20251231.htm
