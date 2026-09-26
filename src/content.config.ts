import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// §3 LogEntry. The full Entry schema lands in §9 step 2.
const log = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/log' }),
  schema: z.object({
    date: z.coerce.date(),
    entrySlug: z.string().optional(),
  }),
});

export const collections = { log };
