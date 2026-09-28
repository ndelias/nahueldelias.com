#!/usr/bin/env node
// npm run screens:update: regenerate the site baselines in tests/screens/.
//
// Baselines come from CI, the environment the gate runs in (macOS renders text
// differently: about 1.3% of pixels). Push first; this finds the CI run for
// HEAD, waits for it if it's still going, and copies its captures into
// tests/screens/. Then review and commit them: every baseline change shows in
// the PR diff.
//
//   npm run screens:update             from the CI run for HEAD
//   npm run screens:update -- --local  capture here instead (build first). For
//                                      iterating only: these won't match CI.

import { execFileSync, spawnSync } from 'node:child_process';
import { cp, mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const BASELINES = join(ROOT, 'tests/screens');
const ARTIFACT = 'site-screens';

const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { cwd: ROOT, encoding: 'utf8', ...opts }).trim();

if (process.argv.includes('--local')) {
  const r = spawnSync('node', ['scripts/screens.mjs', 'site', BASELINES], { cwd: ROOT, stdio: 'inherit' });
  console.warn('\nCaptured locally. These won\'t match CI; don\'t commit them as baselines.');
  process.exit(r.status ?? 1);
}

const sha = run('git', ['rev-parse', 'HEAD']);
const branch = run('git', ['rev-parse', '--abbrev-ref', 'HEAD']);
const remote = spawnSync('git', ['branch', '-r', '--contains', sha], { cwd: ROOT, encoding: 'utf8' }).stdout.trim();
if (!remote) {
  console.error(`HEAD (${sha.slice(0, 7)}) isn't pushed. Push ${branch}, then run this again.`);
  process.exit(1);
}

let runs = [];
for (let tries = 0; !runs.length && tries < 12; tries++) {
  runs = JSON.parse(run('gh', ['run', 'list', '--workflow', 'CI', '--commit', sha, '--json', 'databaseId,status,event,url']));
  if (!runs.length) {
    console.log('Waiting for the CI run for HEAD to appear…');
    await new Promise((r) => setTimeout(r, 5000));
  }
}
if (!runs.length) {
  console.error(`No CI run found for ${sha.slice(0, 7)}.`);
  process.exit(1);
}
const ci = runs.find((r) => r.event === 'push') ?? runs[0];
if (ci.status !== 'completed') {
  console.log(`Waiting for ${ci.url}`);
  spawnSync('gh', ['run', 'watch', String(ci.databaseId), '--interval', '10'], { cwd: ROOT, stdio: 'inherit' });
}

const tmp = await mkdtemp(join(tmpdir(), 'screens-'));
try {
  run('gh', ['run', 'download', String(ci.databaseId), '-n', ARTIFACT, '-D', tmp]);
  const files = (await readdir(tmp)).filter((f) => f.endsWith('.png') && !f.endsWith('.diff.png'));
  if (!files.length) throw new Error(`The ${ARTIFACT} artifact of ${ci.url} has no screenshots.`);
  for (const f of files) await cp(join(tmp, f), join(BASELINES, f));
  console.log(`Copied ${files.length} baselines from ${ci.url}\n`);
  console.log(run('git', ['status', '--short', '--', 'tests/screens']) || 'No baseline changed.');
} finally {
  await rm(tmp, { recursive: true, force: true });
}
