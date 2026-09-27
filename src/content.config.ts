import { defineCollection, type SchemaContext } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { STATUSES, type Section } from './lib/model';

// §3 content model. Each section is its own collection; the section is the
// collection name and the slug is the filename, so neither is repeated in
// frontmatter. Two of the three compile-time rules are enforced here, per
// entry. The third (at most two weight: 1 entries) spans collections and lives
// in src/lib/entries.ts.

// Month precision: "2025-03". YAML leaves this as a string, unquoted.
const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Use a YYYY-MM month, e.g. "2025-03".');

const entrySchema = ({ image }: SchemaContext) => {
  const imageRef = z.object({ src: image(), alt: z.string().min(1) });

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
      versions: z.array(imageRef).optional(),
      cover: imageRef,
      order: z.number().int(),
      // Test and scaffolding entries. Rendered, but noindexed and labeled.
      fixture: z.boolean().default(false),
    })
    .superRefine((entry, ctx) => {
      // Rule 2: a weight 1 or 2 entry without a decision is a screenshot gallery.
      if (entry.weight <= 2 && !entry.decision) {
        ctx.addIssue({
          code: 'custom',
          path: ['decision'],
          message: `Required for weight ${entry.weight} entries (§3 rule 2). Add decision: { chose, rejected, cost }, or make it weight 3.`,
        });
      }
    });
};

const entries = (name: Section) => glob({ pattern: '**/*.mdx', base: `./src/content/${name}` });

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
  writing: defineCollection({ loader: entries('writing'), schema: entrySchema }),
  log,
};
