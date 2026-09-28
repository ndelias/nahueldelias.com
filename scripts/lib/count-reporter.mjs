// A node:test reporter that writes only how many tests ran, as JSON.
// scripts/run-tests.mjs reads it to fail a run that found no tests.
//
// A file with no tests still reports one passing "test", named after the
// file itself; those don't count, and neither do suites.
import { resolve } from 'node:path';

export default async function* countReporter(source) {
  let tests = 0;
  for await (const { type, data } of source) {
    if (type !== 'test:pass' && type !== 'test:fail') continue;
    if (data.details?.type === 'suite') continue;
    if (data.file && resolve(data.name) === resolve(data.file)) continue;
    tests++;
  }
  yield JSON.stringify({ tests });
}
