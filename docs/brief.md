# Portfolio Site — Build Brief

For Nahuel. This brief covers the site itself: its architecture, content model, functional requirements, and design constraints. It deliberately does not specify the projects that go inside it — those are separate work. Written to be handed to a fresh build session.

## 0. Context for a fresh session

Nahuel is a product engineer and founding team member at vers1ons, a music remix licensing and distribution platform. He's building a portfolio site to target Founding Product Engineer and Product Engineer roles at seed-to-Series-B startups. Strategy is already settled in a separate doc; this brief is only about building the container.

The site has one job with three parts: survive an eight-second skim, get a cold applicant past a referral-favoring funnel, and supply defensible material for the conversation and paid work trial where hiring decisions actually get made. It is not trying to win the job by itself.

The site is also itself a portfolio piece. It will be read as evidence of craft, performance sense, and taste. That means well designed, not loudly designed — polish alone is now a suspect signal, and an over-designed portfolio reads as compensating. The bar is precision: considered typography, visible hierarchy, fast loads, correct details.

## 1. Non-negotiable principles

- **Index of working things, not a case-study deck.** The strongest sites in this discipline (rauno.me, paco.me, emilkowal.ski) are short lists of linked, usable artifacts plus writing. Live links beat screenshots. A screenshot dump reads as "I can't show you the real thing."
- **Hierarchy is enforced structurally, not by discipline.** There will be ~10 items across 5 sections. Two of them carry the hire. If the homepage flattens them into a uniform grid, the site fails. The content model must make flattening hard — see §3.
- **Every substantial item names a real decision with a cost.** What was chosen, what was rejected, what it cost. This is the single most-cited differentiator in current hiring commentary and the one thing AI-generated case studies structurally cannot produce.
- **Honesty is a schema field, not a promise.** Concept work is labeled as concept, automatically, by the system. Nothing should be able to imply it shipped when it didn't.
- **Provenance is visible.** Dated build log, linked commit history, v1→v3 shown honestly. Hiring managers now explicitly ask for proof you built it over time, not just that it exists.
- **Speed is a competency claim.** A product engineer's site loading in under a second says something. A 3MB bundle for six pages says something else.

## 2. Information architecture

```
/                     Home — one-screen filmstrip of every entry, landing on
                      W01; (Index) toggles a numbered list (§7.5)
/about                Everything about Nahuel (design pending)
/work/[slug]          Case studies (full template)
/work/vers1ons        + /licensing /distribution /drops sub-studies
/studies/[slug]       Product studies — consumer reasoning, labeled concepts
/data/[slug]          Data projects — hypothesis → evidence → decision
/play                 Creative work: p5.js sketches, the toy, paper projects
/writing              Essay index
/writing/[slug]       Essays
/log                  Dated build log (linked from the homepage frame)
/404                  Easter-egg toy (see §10)
```

Five sections, deliberately unequal:

| Section | Weight | Contains | Purpose |
| --- | --- | --- | --- |
| Work | 1 — dominant | vers1ons, one B2B build | Carries the hire. Full depth. |
| Studies | 2 | Consumer/product studies, app teardowns | Product reasoning independent of employer |
| Data | 2 | Hypothesis-driven analysis, dashboards | The analytical signal — see §4 |
| Play | 3 | p5.js, toys, paper | Craft and appetite. Rewards exploring. |
| Writing | 2 | Essays | Judgment and articulated taste |

Sections render only when populated. The site must ship with two sections live and the rest absent — not visible-but-empty, not "coming soon." Empty states on a portfolio are worse than missing sections.

## 3. Content model

Content lives as MDX files in the repo (Astro content collections — see §8). No CMS. Git history is the provenance record, which is itself part of the point.

```ts
type Weight = 1 | 2 | 3   // 1 = case study, 2 = study, 3 = small thing
type Status = 'shipped' | 'concept' | 'wip' | 'archived'
type Section = 'work' | 'studies' | 'data' | 'play' | 'writing'

interface Entry {
  slug: string
  title: string
  tagline: string          // one line, <100 chars, shown in every index
  section: Section
  weight: Weight
  status: Status           // drives an automatic, non-optional label
  role: string
  dates: { start: string; end?: string }
  stack: string[]
  links: {
    live?: string
    repo?: string
    demo?: string          // recorded walkthrough
  }
  decision?: {             // REQUIRED when weight <= 2 — build fails without it
    chose: string
    rejected: string
    cost: string
  }
  hypothesis?: {           // REQUIRED when section === 'data'
    claim: string
    evidence: string
    outcome: string        // including "I was wrong" outcomes
  }
  versions?: ImageRef[]    // v1 → vN frames for the provenance stack (§7)
  cover: ImageRef
  order: number
}
```

Three constraints the build should enforce at compile time:

1. **At most two entries may have `weight: 1`.** Throw at build time if a third appears. This is the anti-flattening mechanism and it should be impossible to bypass casually.
2. **`decision` is required for `weight <= 2`.** A study without a defensible decision is a screenshot gallery; the schema should refuse to render one.
3. **`status` renders a visible label automatically.** A concept entry carries a concept badge everywhere it appears — index, card, page header, OG image. Not opt-in.

Separately:

```ts
interface LogEntry {
  date: string
  body: string        // MDX
  entrySlug?: string  // optional link to what it's about
}
```

## 4. The data section — specific requirements

This section exists because target roles increasingly require reading data, working with APIs, and building dashboards that drive decisions. It has a required narrative shape, enforced by the `hypothesis` field:

**Claim → what I went and measured → what it actually showed → what I decided → what happened.**

The section must support, technically:

- Interactive charts as client islands (not static images — hover, filter, inspect)
- Data tables with sort and filter on real row counts
- Embedded live dashboards, either as components or sandboxed iframes
- A visible link to the raw data and the notebook/script that produced the analysis

A note for whoever builds this: the credibility of a data project comes from the analysis being inspectable, not from the chart being pretty. Every data entry should link its source data and its code. A conclusion the reader can't check is a conclusion they'll discount.

## 5. Functional requirements

**Must have for v1 launch:**

- MDX pipeline where React components can be embedded inline in prose (live demos, charts, interactive bits sitting inside the narrative)
- Responsive from 320px up, no horizontal scroll, 16px minimum side gutter
- Light and dark themes, both designed — not one inverted (light-first, see §10)
- Screen-recording embeds: poster frame, lazy loaded, never autoplay with sound, explicit dimensions to prevent layout shift
- Per-entry OG images (generated, not hand-made)
- Keyboard operable throughout with visible focus states
- `prefers-reduced-motion` respected everywhere, including p5 sketches
- Build log with dated entries

**Should have, can follow within a week:**

- View transitions between index and detail
- RSS for writing
- p5.js sketches via client-only dynamic import, paused when off-screen
- Privacy-first analytics requiring no cookie banner

**Explicitly out of scope:**

- CMS, auth, comments, newsletter signup, search, i18n
- A blog engine — it's a handful of essays
- Preloaders or loading screens, ever
- Page transitions that delay content appearing
- Any dependency added for one small effect

## 6. Performance and accessibility budget

Treat these as CI gates, not aspirations. Failing the budget should fail the build — and the fact that the repo enforces it is itself a signal to anyone who looks.

| Metric | Budget |
| --- | --- |
| LCP (mobile, throttled 4G) | < 1.2s |
| CLS | < 0.05 |
| JS shipped on `/` | < 100KB compressed |
| Lighthouse (all four categories) | ≥ 95 |
| Color contrast | WCAG AA minimum |
| Fonts | ≤ 2 families, subset, display: swap, preloaded |

Images: modern formats, explicit dimensions, lazy below the fold, eager for the LCP element.

## 7. Design direction

### 7.1 Constraints any direction has to satisfy

- **Hierarchy legible in under three seconds.** A stranger scrolling the homepage must be able to tell which two things matter without reading.
- **Typography carries the page.** Two families maximum, a real type scale, consistent spacing rhythm. Running text near 65 characters.
- **One accent color, used sparingly.** Semantic colors (status, warning) are separate from it and don't count.
- **Neutrals chosen, not defaulted.** A pure mid-grey reads as unconsidered.
- **Motion is purposeful.** This is where microinteraction craft shows — but the homepage should not be a motion demo. Spend it on one or two moments that reward attention.
- **Real artifacts over representations.** Screen recordings over mockups, live embeds over screenshots, working demos over images of working demos.

### 7.2 The key observation about the inspiration set

Nahuel's inspiration folder (15 references, mostly fashion and visual-studio sites) is almost entirely built for many things of equal weight: carousels, rings, grids, piles. That works against the brief's rule that two things must be unmistakably dominant. Since the 2026-09-24 revision the homepage is one of these patterns (the Rue filmstrip), so the hierarchy is carried by explicit rules instead of layout: see "How the hierarchy survives the filmstrip" in §7.5.

### 7.3 Named borrowings

| Reference | What's taken | Where it goes |
| --- | --- | --- |
| Rue Studio (cream page, filmstrip) | Warm off-white ground; small uppercase mono labels pinned to the four corners as the page frame; the horizontal filmstrip with one enlarged, focused item | Site-wide shell; the homepage filmstrip (§7.5) |
| Directors index (D001…D017) | Numbered text list; hovering a row reveals a strip of stills/recordings | The homepage (Index) view (also the no-JS / reduced-motion fallback), section indexes |
| Gramatica grid | Right-aligned year column | Same numbered list |
| every : second (isometric stacks) | Tag list with superscript counts — Work², Studies³ | Section nav on /work and the section index pages (the homepage frame uses Work / About / Log). A zero-count section simply isn't listed, which enforces "render only when populated" visually |
| every : second, second borrowing | Stacked frames riffled by scroll | Provenance stack on case-study pages: v1 → v3 frames from `versions`. One of the two budgeted motion moments |
| Max Pratt | Large identity line, small caption beside it, "Last updated" date | /about header, not the homepage (the filmstrip has no headline). The "Last updated" date, linked to the latest /log entry, can sit in the homepage frame if space allows |
| 4:00pm time-use sim | Data rendered as live, labeled clusters rather than static charts | Signature treatment for /data headers — not the homepage |
| Gem Quest (org-tree lines) | Thin connector lines between related items | /work/vers1ons, linking the licensing / distribution / drops sub-studies |
| Lukas Schneeberger (tilted pile) | Scattered, hand-placed pile of objects | /play index for paper projects |
| Satto ring | Ring of screenshots in perspective | The 404 toy — a ring of the site's own entries (§10) |

### 7.4 Explicitly rejected, and why

- **Curved 3D carousel, Music TV carousel as homepage patterns** — 3D perspective motion demos that would blow the 100KB JS budget. The homepage filmstrip is deliberately the flat, 2D Rue version: CSS transforms only, with explicit hierarchy rules so it doesn't flatten weight.
- **gather° selection tray, frosted-glass phone feed** — strong microinteraction references, but for the consumer studies (Bespoke, the social club), not the container. Filed with those projects.
- **Painterly gradient project cards** — read as a Dribbble template; undercuts "precision, not polish."
- **Avatar network graph** — belongs in a data project if one calls for it, not the site.

### 7.5 The synthesized direction

**Palette.** Warm off-white and warm near-black as the neutral pair (no pure greys). The references are near-monochrome and get color from imagery; the site does the same. One accent: an electric blue (from the curved-carousel and phone references), reserved for links, focus rings, and the concept badge outline. Dark theme is its own warm near-black palette with a re-tuned blue that passes AA — not an inversion.

**Type.** Instrument Sans for headlines and body; DM Mono for all metadata (corner labels, list numbers, years, counts, status badges). The mono carries the "index" feel; the grotesk carries reading. Both free (OFL) — self-host, subset to Latin, `font-display: swap`, preload. Weights: Instrument Sans 400/500 (+600 only if a real need appears), DM Mono 400 only. Target ≈60KB total. Use `font-variant-numeric: tabular-nums` on every number/year column. Chosen over Hanken + IBM Plex Mono (Plex reads generic dev-portfolio), Schibsted + Martian Mono (wide mono crowds corners on phones) and Geist + Geist Mono (the default Vercel look).

**Homepage: filmstrip (revised 2026-09-24).** The first homepage (hero line, two stacked frames, numbered list) was rejected as not creative enough and not showing interaction design. The homepage is now one screen, straight to the projects, with no identity headline:

- Four-corner mono frame (Rue): name + "Product engineer" top-left, (Index) toggle top-center, Work / About / Log top-right, counter 01 / 08 bottom-left, Prev / Next bottom-center, Contact bottom-right.
- A horizontal filmstrip of every entry, edges faded. The focused entry grows to a large 16:10 frame, centered; its still turns into a muted screen recording and its number, section, status badge, title, tagline and "Open →" rise in above it. Focus follows hover, keyboard focus, arrow buttons and click.
- (Index) swaps the strip for a numbered text list with a live preview. This is also the no-JS and reduced-motion fallback.
- Anything about Nahuel lives on /about (inspiration still to come).

**How the hierarchy survives the filmstrip.** A strip treats items as equals by default, so three rules keep the two weight-1 entries dominant: the page lands with W01 focused and playing; W01 and W02 come first; and at rest, weight-1 thumbnails are larger than everything else in the strip.

**Performance note.** The strip is the one hydrated island on /: plain CSS transforms, one `<video>` element swapped into the focused frame, posters as images. Budget it at ~10KB JS; videos load only on focus, never autoplay with sound.

**Motion budget.** (a) The homepage filmstrip focus: grow, still → video, meta rising in. (b) The provenance stack on case-study pages. Everything else is instant. Both respect `prefers-reduced-motion` (the provenance stack becomes a static strip; the filmstrip is replaced by the (Index) list).

### 7.6 Red flags — must not appear

An About Me section with a photo and hobbies, a skills grid with framework logos, a "My Process" section, a double-diamond diagram, testimonials, or a résumé rendered as a web page. Link the PDF.

## 8. Stack — decided

Astro with islands + MDX, deployed on Vercel. Decided 2026-09-24; do not revisit.

**Reasoning:** the design in §7 is mostly static — a mono frame, a server-rendered index, MDX case studies — so most pages need close to zero JavaScript; the homepage filmstrip is one small island on top of the server-rendered list, and Astro ships none by default. That makes the §6 budget (< 100KB JS on /, LCP < 1.2s) straightforward rather than a fight. The heavy interactive surface — charts, dashboards, p5 sketches, the provenance stack — becomes client islands, loaded only where used (`client:visible`). MDX in Astro still embeds React components inline, so nothing in §5 is lost. Content collections with a Zod schema map directly onto §3, and the three compile-time constraints become schema refinements plus one collection-level check.

**Trade-off accepted:** Astro is less familiar to startup reviewers than Next. Offset by the repo itself — a clean, budget-gated Astro repo reads as a deliberate choice, and the case can be made in one log entry.

**Styling:** Tailwind or plain CSS with custom properties for tokens — builder's call in session one, but tokens (color for both themes, type scale, spacing) live as CSS custom properties either way.

The repo should be public from the first commit. It's part of the provenance argument and it's a work sample in its own right.

## 9. Build order

**Minimum shippable site — target 2–3 focused days:**

1. Repo, deploy pipeline, domain, CI with the performance budget wired in from the first commit
2. Content model and MDX pipeline; one dummy entry rendering end to end before any styling
3. Design tokens: color for both themes, type scale, spacing scale, layout primitives
4. Homepage with real hierarchy and placeholder content: the server-rendered (Index) list first, then the filmstrip island (§7.5). Get the two-versus-everything-else rules right before filling anything in
5. The case study template. This is the page that has to be genuinely good; everything else can be plain.
6. Ship it with one real entry and the build log started

**Then, iteratively:**

7. Section index pages, status badges, the tail entries
8. OG image generation, metadata, favicon, RSS
9. /play and whatever lives at 404
10. Performance pass, accessibility pass, real-device check
11. Four-lens review: read the whole site as a seed founder, a CTO, a head of product, and a recruiter with eight seconds

## 10. Decisions before the first commit

| Decision | Status | Resolution |
| --- | --- | --- |
| Domain | Decided | nahueldelias.com — already owned |
| Stack | Decided | Astro + islands + MDX on Vercel (§8) |
| Theme | Decided | Light-first; dark is a separately designed warm near-black palette, not an inversion |
| Name treatment | Decided | Full name + "Product engineer", small, in mono, top-left corner of the frame. There is no headline on the homepage (§7.5) |
| Type | Decided | Instrument Sans + DM Mono (§7.5) |
| Toy location | Decided | Both: the p5 toy lives at /play; the 404 gets the Satto-style ring of the site's own entries, doubling as navigation back in |
| Identity line wording | Open | Must be tailored to Nahuel specifically, not a generic product-engineer line. Designs use the placeholder below until it's written |

**Identity line:** no longer on the homepage. It's used for the /about header, the site's meta description and the default OG image. It must not lead with music. Music is evidence, not identity — a music-first line filters into a small market. Something closer to "Product engineer. I build products in domains where the rules are complicated and the interface can't be." The filmstrip then shows music licensing marketplace, agent governance, consumer marketplace — and the reader concludes range.

Still needed: the final identity line. It doesn't block the first commit; the placeholder ships until it's written.

## 11. Definition of done for v1

The site ships when a stranger can, in under thirty seconds: tell what Nahuel does, tell which two projects matter most, click into one, and find a real decision with a stated cost. Everything beyond that is iteration and should happen in public, with dated log entries, while applications are already going out.
