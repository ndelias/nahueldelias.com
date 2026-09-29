import { defineCollection, type SchemaContext } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { DISCIPLINES, ESSAY_STATUSES, FRAMES, STATUSES, type Section } from './lib/model';

// §3 content model. Each entry section is its own collection; the section is the
// collection name and the slug is the filename, so neither is repeated in
// frontmatter. Two of the three compile-time rules are enforced here, per
// entry. The third (at most two weight: 1 entries) spans collections and lives
// in src/lib/entries.ts, as do the part rules that need the parent entry.

// Month precision: "2025-03". YAML leaves this as a string, unquoted.
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
// Parts (entries with a parent) need at least this many gallery screens.
export const MIN_PART_GALLERY = 3;

// Fixtures may hold a bracketed placeholder ("[Years]") instead, so an unknown
// date renders as visibly unknown rather than as a made-up one.
const PLACEHOLDER = /^\[.+\]$/;
const month = z
  .string()
  .refine((v) => MONTH.test(v) || PLACEHOLDER.test(v), 'Use a YYYY-MM month, e.g. "2025-03".');

const entrySchema = ({ image }: SchemaContext) => {
  const imageRef = z.object({ src: image(), alt: z.string().min(1) });
  const disciplines = z.array(z.enum(DISCIPLINES));

  return z
    .object({
      title: z.string().min(1),
      tagline: z.string().min(1).max(99, 'Taglines are one line: under 100 characters.'),
      weight: z.union([z.literal(1), z.literal(2), z.literal(3)]),
      status: z.enum(STATUSES),
      role: z.string().min(1),
      dates: z.object({ start: month, end: month.optional() }),
      stack: z.array(z.string().min(1)),
      links: z
        .object({
          live: z.url().optional(),
          repo: z.url().optional(),
          demo: z.url().optional(),
        })
        .default({}),
      decision: z
        .object({
          chose: z.string().min(1),
          rejected: z.string().min(1),
          cost: z.string().min(1),
        })
        .optional(),
      hypothesis: z
        .object({
          claim: z.string().min(1),
          evidence: z.string().min(1),
          outcome: z.string().min(1),
        })
        .optional(),
      // v1 → vN frames for the provenance stack, oldest first. The label
      // defaults to v1, v2…
      versions: z
        .array(
          imageRef.extend({
            label: z.string().min(1).optional(),
            date: month,
            note: z.string().min(1),
          }),
        )
        .optional(),
      // Full-width still or recording under the header. With a video, the
      // image is its poster and the recording plays on request, muted.
      hero: imageRef
        .extend({
          video: z.string().min(1).optional(),
          // "0:48", shown beside "Walkthrough · muted".
          duration: z.string().min(1).optional(),
          // The flow the recording walks through, or the one thing to notice.
          caption: z.string().min(1).optional(),
        })
        .optional(),
      gallery: z
        .array(
          z.object({
            src: image(),
            alt: z.string({ error: 'Required: describe what the screen shows.' }).min(1, 'Required: describe what the screen shows.'),
            caption: z.string().min(1).optional(),
            frame: z.enum(FRAMES).default('desktop'),
          }),
        )
        .optional(),
      // Slug of the hub entry. Set on parts (vers1ons/licensing…), which live
      // in the hub's folder: src/content/work/vers1ons/licensing.mdx.
      parent: z.string().min(1).optional(),
      // What the entry demonstrates. Shown on the hub's parts matrix.
      disciplines: z.object({ led: disciplines, contributed: disciplines }).optional(),
      cover: imageRef,
      // The homepage strip's still, 16:10, at least 1040×650 (2x the focused
      // frame). Optionally a dark-theme variant. Falls back to the cover.
      poster: z.object({ src: image(), dark: image().optional() }).optional(),
      // Muted screen recording that replaces the poster once the entry is
      // focused on the homepage strip. A path under public/ or a URL.
      video: z.string().min(1).optional(),
      order: z.number().int(),
      // Test and scaffolding entries. Rendered, but noindexed and labeled.
      fixture: z.boolean().default(false),
    })
    .superRefine((entry, ctx) => {
      for (const key of ['start', 'end'] as const) {
        const value = entry.dates[key];
        if (value && PLACEHOLDER.test(value) && !entry.fixture) {
          ctx.addIssue({
            code: 'custom',
            path: ['dates', key],
            message: `"${value}" is a placeholder. Only fixture entries may use one; use a YYYY-MM month.`,
          });
        }
      }
      if (entry.disciplines) {
        const both = entry.disciplines.led.filter((d) => entry.disciplines!.contributed.includes(d));
        if (both.length) {
          ctx.addIssue({
            code: 'custom',
            path: ['disciplines'],
            message: `${both.join(', ')} can't be both led and contributed. Keep it in one list.`,
          });
        }
      }
      // Parts (§3 hub and parts). The rules that need the parent entry itself
      // are in src/lib/entries.ts.
      if (entry.parent) {
        if (entry.weight !== 2) {
          ctx.addIssue({
            code: 'custom',
            path: ['weight'],
            message: 'Parts are weight 2 (§3 hub and parts). Only their hub carries weight 1.',
          });
        }
        if (!entry.decision) {
          ctx.addIssue({
            code: 'custom',
            path: ['decision'],
            message: 'Required for parts (§3 hub and parts): every part has its own decision. Add decision: { chose, rejected, cost }.',
          });
        }
        const screens = entry.gallery?.length ?? 0;
        if (screens < MIN_PART_GALLERY) {
          ctx.addIssue({
            code: 'custom',
            path: ['gallery'],
            message: `Parts need at least ${MIN_PART_GALLERY} gallery screens (§3 hub and parts). Found ${screens}.`,
          });
        }
        if (!entry.disciplines || entry.disciplines.led.length + entry.disciplines.contributed.length === 0) {
          ctx.addIssue({
            code: 'custom',
            path: ['disciplines'],
            message: "Required for parts: the hub's matrix shows what each part led and contributed. Add disciplines: { led, contributed }.",
          });
        }
      }
      // Rule 2: a weight 1 or 2 entry without a decision is a screenshot gallery.
      if (entry.weight <= 2 && !entry.decision && !entry.parent) {
        ctx.addIssue({
          code: 'custom',
          path: ['decision'],
          message: `Required for weight ${entry.weight} entries (§3 rule 2). Add decision: { chose, rejected, cost }, or make it weight 3.`,
        });
      }
    });
};

const entries = (name: Section) => glob({ pattern: '**/*.mdx', base: `./src/content/${name}` });

// Every essay commits to a position a reader can disagree with.
const THESIS_REQUIRED = 'Required for essays (§3). State the position a reader could disagree with.';

// §3 Essay. Not an Entry: no weight, decision or section. Drafts are filtered
// out of production builds in src/lib/essays.ts.
const writing = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/writing' }),
  schema: z.object({
    title: z.string().min(1),
    dek: z.string().min(1).max(99, 'Deks are one line: under 100 characters.'),
    thesis: z
      .string({ error: THESIS_REQUIRED })
      .min(1, THESIS_REQUIRED),
    date: z.coerce.date(),
    updated: z.coerce.date().optional(),
    status: z.enum(ESSAY_STATUSES),
  }),
});

// §3 LogEntry.
const log = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/log' }),
  schema: z.object({
    date: z.coerce.date(),
    entrySlug: z.string().optional(),
  }),
});

export const collections = {
  work: defineCollection({ loader: entries('work'), schema: entrySchema }),
  studies: defineCollection({ loader: entries('studies'), schema: entrySchema }),
  data: defineCollection({
    loader: entries('data'),
    // Rule 3 (§4): a data entry has to state what it set out to prove.
    schema: (ctx) =>
      entrySchema(ctx).superRefine((entry, issues) => {
        if (!entry.hypothesis) {
          issues.addIssue({
            code: 'custom',
            path: ['hypothesis'],
            message: 'Required for data entries (§4). Add hypothesis: { claim, evidence, outcome }.',
          });
        }
      }),
  }),
  play: defineCollection({ loader: entries('play'), schema: entrySchema }),
  writing,
  log,
};
