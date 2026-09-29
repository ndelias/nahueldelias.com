// Lighthouse CI (§6). Every audited page must score ≥ 95 in performance,
// accessibility and best practices, with LCP < 1.2s, CLS < 0.05 and no
// contrast failures, on simulated mobile 4G.
//
// SEO is asserted on every page that can be indexed. A fixture page carries
// <meta name="robots" content="noindex"> on purpose, which Lighthouse's SEO
// category marks down, so SEO is skipped on exactly the pages that say
// noindex, read from the built HTML. A page stops being skipped the moment it
// stops being a fixture.
const { existsSync, readFileSync } = require('node:fs');
const { join } = require('node:path');

const DIST = join(__dirname, 'dist');
// The pages the budget is measured on. A page that isn't built yet (the part
// template before it exists) is left out rather than failing on a 404.
const PAGES = ['/', '/work/vers1ons/', '/work/vers1ons/distribution/'];

const file = (url) => join(DIST, url, 'index.html');
const built = PAGES.filter((url) => existsSync(file(url)));
const noindex = (url) => /<meta name="robots" content="noindex"/.test(readFileSync(file(url), 'utf8'));
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');

const median = (minScore) => ['error', { minScore, aggregationMethod: 'median' }];
const BUDGET = {
  'categories:performance': median(0.95),
  'categories:accessibility': median(0.95),
  'categories:best-practices': median(0.95),
  'largest-contentful-paint': ['error', { maxNumericValue: 1199, aggregationMethod: 'median' }],
  'cumulative-layout-shift': ['error', { maxNumericValue: 0.049, aggregationMethod: 'median' }],
  'color-contrast': median(1),
};

module.exports = {
  ci: {
    collect: {
      staticDistDir: './dist',
      url: built,
      numberOfRuns: 3,
      settings: { formFactor: 'mobile', throttlingMethod: 'simulate' },
    },
    assert: {
      assertMatrix: built.map((url) => ({
        matchingUrlPattern: `^https?://[^/]+${escape(url)}$`,
        assertions: noindex(url) ? BUDGET : { ...BUDGET, 'categories:seo': median(0.95) },
      })),
    },
    upload: { target: 'filesystem', outputDir: './.lighthouseci/reports' },
  },
};
