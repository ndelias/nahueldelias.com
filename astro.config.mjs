// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';

export default defineConfig({
  site: 'https://nahueldelias.com',
  output: 'static',
  // Scope component styles with a short class, not a data-astro-cid-*
  // attribute on every element: same specificity, fewer bytes in each
  // page's HTML (the HTML budget).
  scopedStyleStrategy: 'class',
  integrations: [mdx()],
  // Inline all CSS. It's a few KB per page, and a separate stylesheet would
  // put a render-blocking round trip in front of LCP. The default inlines
  // only under 4KB, a threshold the base styles already sit on.
  build: { inlineStylesheets: 'always' },
  vite: {
    build: {
      // Inline the homepage filmstrip island into the page. Under simulated
      // 4G, every request that finishes before the largest paint counts
      // toward LCP; inlined, the island adds ~2.7KB gzip to the HTML and no
      // request. Everything else keeps Vite's default (under 4KB inlined).
      assetsInlineLimit: (file) => (/Filmstrip\.astro_astro_type_script/.test(file) ? true : undefined),
    },
  },
});
