// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import preact from '@astrojs/preact';

export default defineConfig({
  site: 'https://nahueldelias.com',
  output: 'static',
  // Scope component styles with a short class, not a data-astro-cid-*
  // attribute on every element: same specificity, fewer bytes in each
  // page's HTML (the HTML budget).
  scopedStyleStrategy: 'class',
  // Preact with React compatibility, for the one island that runs Framer
  // Motion (the money page): ~38KB there, nothing anywhere else.
  integrations: [mdx(), preact({ compat: true })],
  // About became the homepage: old links to /about land there.
  redirects: { '/about': '/' },
  // Inline all CSS. It's a few KB per page, and a separate stylesheet would
  // put a render-blocking round trip in front of LCP. The default inlines
  // only under 4KB, a threshold the base styles already sit on.
  build: { inlineStylesheets: 'always' },
  vite: {
    // Framer Motion imports react: bundle it for the server render too, so
    // the compat alias (react → preact/compat) reaches it there as well.
    // (Vite 8 prerenders static pages in an environment of its own.)
    ssr: { noExternal: ['framer-motion', 'motion-dom', 'motion-utils'] },
    environments: {
      prerender: { resolve: { noExternal: ['framer-motion', 'motion-dom', 'motion-utils'] } },
    },
    build: {
      // Inline the constellation island (/work) into the page. Under
      // simulated 4G, every request that finishes before the largest paint
      // counts toward LCP; inlined, the island adds ~3.2KB gzip to the HTML
      // and no request (measured: LCP 1203ms as a file). Everything else
      // keeps Vite's default (under 4KB inlined).
      assetsInlineLimit: (file) => (/Constellation\.astro_astro_type_script/.test(file) ? true : undefined),
    },
  },
});
