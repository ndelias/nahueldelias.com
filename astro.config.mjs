// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';

export default defineConfig({
  site: 'https://nahueldelias.com',
  output: 'static',
  integrations: [mdx()],
  // Inline all CSS. It's a few KB per page, and a separate stylesheet would
  // put a render-blocking round trip in front of LCP. The default inlines
  // only under 4KB, a threshold the base styles already sit on.
  build: { inlineStylesheets: 'always' },
});
