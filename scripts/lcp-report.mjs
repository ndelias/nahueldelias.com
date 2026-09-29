#!/usr/bin/env node
// LCP report, from the Lighthouse CI reports (.lighthouseci/reports/): for
// each audited page, the median run's largest contentful paint, the element
// it was, the four-part breakdown (time to first byte, resource load delay,
// load time, render delay) and, for an image, the request that fed it.
// A report, not a gate: lighthouserc.cjs holds LCP under 1.2s.
//
//   node scripts/lcp-report.mjs [reportsDir]

import { readdir, readFile, appendFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const DIR = resolve(process.argv[2] ?? '.lighthouseci/reports');
if (!existsSync(DIR)) {
  console.error(`No Lighthouse reports at ${DIR}. Run \`npx lhci autorun\` first.`);
  process.exit(1);
}

const runs = [];
for (const name of await readdir(DIR)) {
  if (!name.endsWith('.report.json')) continue;
  const r = JSON.parse(await readFile(join(DIR, name), 'utf8'));
  runs.push(r);
}
const byPage = new Map();
for (const r of runs) {
  const path = new URL(r.finalDisplayedUrl ?? r.finalUrl).pathname;
  byPage.set(path, [...(byPage.get(path) ?? []), r]);
}

const ms = (n) => `${Math.round(n)} ms`;
const lines = ['| Page | LCP | Element | TTFB | Load delay | Load time | Render delay | Resource |', '| --- | ---: | --- | ---: | ---: | ---: | ---: | --- |'];
const text = [];
for (const [path, list] of [...byPage].sort()) {
  const lcp = (r) => r.audits['largest-contentful-paint'].numericValue;
  const sorted = [...list].sort((a, b) => lcp(a) - lcp(b));
  const r = sorted[Math.floor(sorted.length / 2)];
  const items = r.audits['largest-contentful-paint-element']?.details?.items ?? [];
  const node = items[0]?.items?.[0]?.node;
  const phases = Object.fromEntries((items[1]?.items ?? []).map((p) => [p.phase, p.timing]));
  const element = node ? `${node.nodeLabel?.slice(0, 60) ?? ''} (\`${node.selector?.split(' > ').slice(-2).join(' > ') ?? node.snippet}\`)` : 'unknown';
  // For an image, the request that fed it: the snippet's src is the source
  // the browser picked (currentSrc), so it names the AVIF or WebP that loaded.
  const src = node?.snippet?.match(/\ssrc="([^"]+)"/)?.[1];
  const img = src && (r.audits['network-requests']?.details?.items ?? []).find((q) => q.url === src);
  const resource = img ? `${img.url.split('/').pop()} · ${(img.transferSize / 1000).toFixed(1)} KB · ${img.priority} priority` : 'text (no resource)';
  const row = [
    path,
    ms(lcp(r)),
    element,
    ms(phases.TTFB ?? 0),
    ms(phases['Load Delay'] ?? 0),
    ms(phases['Load Time'] ?? 0),
    ms(phases['Render Delay'] ?? 0),
    resource,
  ];
  lines.push(`| ${row.join(' | ')} |`);
  text.push(`${path}\n  LCP ${ms(lcp(r))} (median of ${list.length}; all: ${list.map((x) => Math.round(lcp(x))).join(', ')})\n  element: ${element}\n  TTFB ${row[3]} · load delay ${row[4]} · load time ${row[5]} · render delay ${row[6]}\n  resource: ${resource}`);
}

console.log(text.join('\n\n'));
if (process.env.GITHUB_STEP_SUMMARY) {
  await appendFile(process.env.GITHUB_STEP_SUMMARY, `### Largest contentful paint (mobile, simulated 4G)\n\n${lines.join('\n')}\n`);
}
