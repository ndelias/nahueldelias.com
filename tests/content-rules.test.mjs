// §3 build-time rules: each bad entry must fail `astro build` with a message
// that names the rule and the offending file. A control build with valid
// content proves the failures come from the entries, not from the harness.
//
// Each case builds a throwaway copy of the site in a temp dir, with the real
// config and code but only the content the test writes. node_modules is
// symlinked, not copied.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { cp, mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const SECTIONS = ['work', 'studies', 'data', 'play', 'writing'];
const COPY = ['src', 'public', 'astro.config.mjs', 'tsconfig.json', 'package.json'];

const DECISION = { chose: 'A', rejected: 'B', cost: 'C' };
const HYPOTHESIS = { claim: 'A', evidence: 'B', outcome: 'C' };

// A valid entry, overridable per test. JSON is valid YAML, so frontmatter is
// written as JSON and needs no YAML serializer.
const entry = (overrides = {}) => ({
  title: 'Test entry',
  tagline: 'A test tagline.',
  weight: 3,
  status: 'shipped',
  role: 'Engineer',
  dates: { start: '2026-01' },
  stack: ['Astro'],
  cover: { src: '../../assets/fixtures/cover.svg', alt: 'Cover' },
  order: 0,
  ...overrides,
});

// A valid essay. Writing has its own schema: no weight, decision or section.
const essay = (overrides = {}) => ({
  title: 'Test essay',
  dek: 'A test dek.',
  thesis: 'A position a reader can disagree with.',
  date: '2026-09-01',
  status: 'published',
  ...overrides,
});

/** Build a copy of the site with exactly these entries: { 'work/a': {...} }. */
async function build(files) {
  const dir = await mkdtemp(join(tmpdir(), 'content-rules-'));
  for (const name of COPY) await cp(join(ROOT, name), join(dir, name), { recursive: true });
  await symlink(join(ROOT, 'node_modules'), join(dir, 'node_modules'), 'dir');
  for (const section of SECTIONS) await rm(join(dir, 'src/content', section), { recursive: true, force: true });

  for (const [path, data] of Object.entries(files)) {
    const file = join(dir, 'src/content', `${path}.mdx`);
    await mkdir(join(file, '..'), { recursive: true });
    await writeFile(file, `---\n${JSON.stringify(data, null, 2)}\n---\n\nBody.\n`);
  }

  const child = spawn(process.execPath, [join(ROOT, 'node_modules/astro/bin/astro.mjs'), 'build'], {
    cwd: dir,
    env: { ...process.env, ASTRO_TELEMETRY_DISABLED: '1', NO_COLOR: '1', FORCE_COLOR: '0' },
  });
  let output = '';
  child.stdout.on('data', (chunk) => (output += chunk));
  child.stderr.on('data', (chunk) => (output += chunk));
  const code = await new Promise((done) => child.on('close', done));

  return {
    code,
    output,
    read: (path) => readFile(join(dir, 'dist', path), 'utf8'),
    cleanup: () => rm(dir, { recursive: true, force: true }),
  };
}

async function assertFails(result, ...expected) {
  try {
    assert.notEqual(result.code, 0, `Build should have failed:\n${result.output}`);
    for (const text of expected) assert.ok(result.output.includes(text), `Expected "${text}" in:\n${result.output}`);
  } finally {
    await result.cleanup();
  }
}

test('control: valid content builds, and a concept entry renders its badge in the page header', async () => {
  const result = await build({
    'work/first': entry({ weight: 1, decision: DECISION }),
    'work/second': entry({ weight: 1, decision: DECISION, status: 'concept' }),
    'play/small': entry({ weight: 3 }), // weight 3: no decision needed
    'data/analysis': entry({ weight: 2, decision: DECISION, hypothesis: HYPOTHESIS }),
    'writing/essay': essay(), // no weight or decision: writing is outside rules 1 and 2
  });
  try {
    assert.equal(result.code, 0, `Build should have passed:\n${result.output}`);
    const html = await result.read('work/second/index.html');
    const header = html.match(/<header>[\s\S]*?<\/header>/)?.[0] ?? '';
    assert.match(header, /<span class="status-badge" data-status="concept">Concept<\/span>/);
  } finally {
    await result.cleanup();
  }
});

test('rule 1: a third weight: 1 entry fails the build and names every weight: 1 file', async () => {
  const result = await build({
    'work/first': entry({ weight: 1, decision: DECISION }),
    'work/second': entry({ weight: 1, decision: DECISION }),
    'studies/third': entry({ weight: 1, decision: DECISION }),
  });
  await assertFails(
    result,
    'At most 2 entries may have weight: 1 (§3 rule 1). Found 3:',
    'src/content/work/first.mdx',
    'src/content/work/second.mdx',
    'src/content/studies/third.mdx',
  );
});

test('rule 2: a weight <= 2 entry without decision fails the build and names the file', async () => {
  const result = await build({
    'studies/study': entry({ weight: 2 }),
  });
  await assertFails(result, 'studies → study', 'decision: Required for weight 2 entries (§3 rule 2)', 'src/content/studies/study.mdx');
});

test('rule 3: a data entry without hypothesis fails the build and names the file', async () => {
  const result = await build({
    'data/analysis': entry({ weight: 3 }),
  });
  await assertFails(result, 'data → analysis', 'hypothesis: Required for data entries (§4)', 'src/content/data/analysis.mdx');
});

test('essay: a writing entry without thesis fails the build and names the file', async () => {
  const { thesis, ...noThesis } = essay();
  const result = await build({
    'writing/essay': noThesis,
  });
  await assertFails(result, 'writing → essay', 'thesis: Required for essays (§3)', 'src/content/writing/essay.mdx');
});
