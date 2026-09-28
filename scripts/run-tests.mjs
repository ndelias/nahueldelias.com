#!/usr/bin/env node
// node --test, except that finding nothing is a failure. node's runner exits
// 0 when a glob matches no files or the files hold no tests, which is how
// tests/dist/ ran zero tests in CI for a whole PR without anyone noticing.
//
//   node scripts/run-tests.mjs 'tests/*.test.mjs' [...more globs]

import { spawnSync } from 'node:child_process';
import { globSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const patterns = process.argv.slice(2);
const files = patterns.flatMap((p) => globSync(p)).sort();
if (!files.length) {
  console.error(`No test files match ${patterns.join(' ')}.`);
  process.exit(1);
}

const dir = mkdtempSync(join(tmpdir(), 'tests-'));
const countsFile = join(dir, 'counts.json');
const reporter = new URL('./lib/count-reporter.mjs', import.meta.url).href;
try {
  const run = spawnSync(
    process.execPath,
    ['--test', '--test-reporter=spec', '--test-reporter-destination=stdout', `--test-reporter=${reporter}`, `--test-reporter-destination=${countsFile}`, ...files],
    { stdio: 'inherit' },
  );
  const counts = JSON.parse(readFileSync(countsFile, 'utf8'));
  if (!counts.tests) {
    console.error(`\nNo tests ran in ${files.join(', ')}.`);
    process.exit(1);
  }
  process.exit(run.status ?? 1);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
