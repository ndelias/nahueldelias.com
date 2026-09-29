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
import { existsSync } from 'node:fs';
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
async function build(files, env = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'content-rules-'));
  for (const name of COPY) if (existsSync(join(ROOT, name))) await cp(join(ROOT, name), join(dir, name), { recursive: true });
  await symlink(join(ROOT, 'node_modules'), join(dir, 'node_modules'), 'dir');
  for (const section of SECTIONS) await rm(join(dir, 'src/content', section), { recursive: true, force: true });

  for (const [path, data] of Object.entries(files)) {
    const file = join(dir, 'src/content', `${path}.mdx`);
    await mkdir(join(file, '..'), { recursive: true });
    await writeFile(file, `---\n${JSON.stringify(data, null, 2)}\n---\n\nBody.\n`);
  }

  const child = spawn(process.execPath, [join(ROOT, 'node_modules/astro/bin/astro.mjs'), 'build'], {
    cwd: dir,
    env: { ...process.env, SHIP: undefined, ...env, ASTRO_TELEMETRY_DISABLED: '1', NO_COLOR: '1', FORCE_COLOR: '0' },
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
    const header = html.match(/<header[^>]*data-entry-header[^>]*>[\s\S]*?<\/header>/)?.[0] ?? '';
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

test('ship: with SHIP=1, any fixture entry fails the build and names every fixture file', async () => {
  const result = await build(
    {
      'work/real': entry({ weight: 1, decision: DECISION }),
      'work/placeholder': entry({ weight: 1, decision: DECISION, fixture: true }),
      'play/sketch': entry({ fixture: true }),
    },
    { SHIP: '1' },
  );
  await assertFails(
    result,
    "SHIP=1: 2 fixture entries can't ship:",
    'src/content/work/placeholder.mdx',
    'src/content/play/sketch.mdx',
  );
});

test('ship: the same fixtures build without SHIP=1, and real content builds with it', async () => {
  const withFixtures = await build({
    'work/placeholder': entry({ weight: 1, decision: DECISION, fixture: true }),
  });
  const shipped = await build({ 'work/real': entry({ weight: 1, decision: DECISION }) }, { SHIP: '1' });
  try {
    assert.equal(withFixtures.code, 0, `Fixtures should build without SHIP=1:\n${withFixtures.output}`);
    assert.equal(shipped.code, 0, `Real content should build with SHIP=1:\n${shipped.output}`);
  } finally {
    await withFixtures.cleanup();
    await shipped.cleanup();
  }
});

test('placeholder dates: a bracketed date fails the build unless the entry is a fixture', async () => {
  const result = await build({ 'play/real': entry({ dates: { start: '[Year]' } }) });
  await assertFails(result, 'play → real', 'dates.start: "[Year]" is a placeholder. Only fixture entries may use one', 'src/content/play/real.mdx');
});

// Hub and parts (§3). A part lives in its hub's folder, one level down, so
// its image paths have one more ../.
const PART_IMAGE = '../../../assets/fixtures/cover.svg';
const part = (overrides = {}) =>
  entry({
    parent: 'hub',
    weight: 2,
    decision: DECISION,
    disciplines: { led: ['backend'], contributed: ['frontend'] },
    cover: { src: PART_IMAGE, alt: 'Cover' },
    gallery: [1, 2, 3].map((n) => ({ src: PART_IMAGE, alt: `Screen ${n}`, frame: 'desktop' })),
    ...overrides,
  });

test('parts: a part without a decision fails the build and names the file', async () => {
  const { decision, ...noDecision } = part();
  const result = await build({
    'work/hub': entry({ weight: 1, decision: DECISION }),
    'work/hub/licensing': noDecision,
  });
  await assertFails(result, 'work → hub/licensing', 'decision: Required for parts (§3 hub and parts)', 'src/content/work/hub/licensing.mdx');
});

test('parts: a part with fewer than 3 gallery screens fails the build and names the file', async () => {
  const result = await build({
    'work/hub': entry({ weight: 1, decision: DECISION }),
    'work/hub/licensing': part({ gallery: [{ src: PART_IMAGE, alt: 'One' }, { src: PART_IMAGE, alt: 'Two' }] }),
  });
  await assertFails(result, 'work → hub/licensing', 'gallery: Parts need at least 3 gallery screens (§3 hub and parts). Found 2.', 'src/content/work/hub/licensing.mdx');
});

test('parts: a gallery screen without alt text fails the build', async () => {
  const result = await build({
    'work/hub': entry({ weight: 1, decision: DECISION }),
    'work/hub/licensing': part({ gallery: [1, 2, 3].map(() => ({ src: PART_IMAGE })) }),
  });
  await assertFails(result, 'work → hub/licensing', 'Required: describe what the screen shows.');
});

test('parts: a parent that is not an entry fails the build and names the file', async () => {
  const result = await build({
    'work/hub': entry({ weight: 1, decision: DECISION }),
    'work/hub/licensing': part({ parent: 'nope' }),
  });
  await assertFails(result, 'Parts must point to an existing weight 1 hub', "src/content/work/hub/licensing.mdx: parent 'nope' isn't an entry in work. Weight 1 entries there: hub.");
});

test('parts: a parent that is not weight 1 fails the build and names the file', async () => {
  const result = await build({
    'work/hub': entry({ weight: 2, decision: DECISION }),
    'work/hub/licensing': part(),
  });
  await assertFails(result, "src/content/work/hub/licensing.mdx: parent 'hub' is weight 2. Only a weight 1 entry can be a hub.");
});

test('parts: a part outside its hub folder fails the build', async () => {
  const result = await build({
    'work/hub': entry({ weight: 1, decision: DECISION }),
    'work/licensing': part({ cover: { src: '../../assets/fixtures/cover.svg', alt: 'Cover' }, gallery: [1, 2, 3].map((n) => ({ src: '../../assets/fixtures/cover.svg', alt: `S${n}` })) }),
  });
  await assertFails(result, "src/content/work/licensing.mdx: a part lives in its hub's folder, src/content/work/hub/.");
});

test('parts: a weight 1 part fails the build, so parts can never raise the cap', async () => {
  const result = await build({
    'work/hub': entry({ weight: 1, decision: DECISION }),
    'work/hub/licensing': part({ weight: 1 }),
  });
  await assertFails(result, 'work → hub/licensing', 'weight: Parts are weight 2 (§3 hub and parts)');
});

test("parts: they don't count toward the weight 1 cap and never appear on the homepage", async () => {
  const result = await build({
    'work/hub': entry({ weight: 1, decision: DECISION, title: 'The hub' }),
    'work/other': entry({ weight: 1, decision: DECISION }),
    'work/hub/licensing': part({ title: 'Licensing part', tagline: 'Only on the hub.' }),
    'work/hub/payouts': part({ title: 'Payouts part', tagline: 'Only on the hub.', order: 1 }),
  });
  try {
    assert.equal(result.code, 0, `Two hubs plus parts should build:\n${result.output}`);
    const home = await result.read('index.html');
    assert.ok(home.includes('The hub'), 'the hub is on the homepage');
    assert.ok(!home.includes('Licensing part') && !home.includes('Payouts part'), 'a part appears on the homepage');
    assert.ok(!home.includes('Only on the hub.'), "a part's tagline appears on the homepage");
    const hub = await result.read('work/hub/index.html');
    assert.ok(hub.includes('Licensing part') && hub.includes('Payouts part'), "the hub's matrix lists its parts");
    assert.match(hub, /Zero to one, in two parts/);
  } finally {
    await result.cleanup();
  }
});
