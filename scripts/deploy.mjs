#!/usr/bin/env node
// Deploys a static directory to Vercel through the REST API.
//
// Why not the Vercel CLI: it looks up the user account before anything else,
// which a project-scoped token can't do. This script only needs the endpoints
// that token allows, so the CI secret can only ever touch this one project.
//
// Usage: node scripts/deploy.mjs [dir=dist] [--prod]
// Env:   VERCEL_TOKEN, VERCEL_ORG_ID, VERCEL_PROJECT_ID

import { readFile, readdir, appendFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, relative, resolve, sep } from 'node:path';

const args = process.argv.slice(2);
const prod = args.includes('--prod');
const dir = resolve(args.find((a) => !a.startsWith('--')) ?? 'dist');
const { VERCEL_TOKEN: token, VERCEL_ORG_ID: teamId, VERCEL_PROJECT_ID: projectId } = process.env;

if (!token || !teamId || !projectId) {
  console.error('VERCEL_TOKEN, VERCEL_ORG_ID and VERCEL_PROJECT_ID must be set.');
  process.exit(1);
}

const api = async (path, init = {}) => {
  const url = `https://api.vercel.com${path}${path.includes('?') ? '&' : '?'}teamId=${teamId}`;
  const res = await fetch(url, { ...init, headers: { Authorization: `Bearer ${token}`, ...init.headers } });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, body };
};

async function walk(d) {
  const out = [];
  for (const e of await readdir(d, { withFileTypes: true })) {
    const p = join(d, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else if (e.isFile()) out.push(p);
  }
  return out;
}

const files = await Promise.all(
  (await walk(dir)).map(async (path) => {
    const data = await readFile(path);
    return {
      file: relative(dir, path).split(sep).join('/'),
      sha: createHash('sha1').update(data).digest('hex'),
      size: data.length,
      data,
    };
  }),
);
if (!files.length) {
  console.error(`Nothing to deploy in ${dir}.`);
  process.exit(1);
}

async function upload(f) {
  const { ok, body } = await api('/v2/files', {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream', 'x-vercel-digest': f.sha },
    body: f.data,
  });
  if (!ok) throw new Error(`Upload failed for ${f.file}: ${JSON.stringify(body.error)}`);
}

const payload = {
  name: 'nahueldelias-com',
  project: projectId,
  // Omitting target means preview. The API rejects target: 'preview'.
  ...(prod && { target: 'production' }),
  files: files.map(({ file, sha, size }) => ({ file, sha, size })),
  projectSettings: { framework: null, buildCommand: null, installCommand: null, outputDirectory: null },
  ...(process.env.GITHUB_SHA && {
    meta: {
      githubCommitSha: process.env.GITHUB_SHA,
      githubCommitRef: process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME,
    },
  }),
};

// Vercel dedupes by SHA: create first, upload only what it reports missing, retry.
let res = await api('/v13/deployments?skipAutoDetectionConfirmation=1', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
});
if (res.body.error?.code === 'missing_files') {
  const missing = new Set(res.body.error.missing);
  const queue = files.filter((f) => missing.has(f.sha));
  console.log(`Uploading ${queue.length} of ${files.length} files`);
  await Promise.all(Array.from({ length: 8 }, async () => { while (queue.length) await upload(queue.shift()); }));
  res = await api('/v13/deployments?skipAutoDetectionConfirmation=1', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}
if (!res.ok) {
  console.error(`Deployment failed: ${JSON.stringify(res.body.error)}`);
  process.exit(1);
}

const { id } = res.body;
// A project's first deployment is promoted to production even without a target.
// Fail loudly if a preview ever lands there.
if (!prod && res.body.target === 'production') {
  console.error(`Expected a preview but Vercel created a production deployment (${id}).`);
  process.exit(1);
}

let state = res.body.readyState;
const deadline = Date.now() + 5 * 60_000;
while (!['READY', 'ERROR', 'CANCELED'].includes(state)) {
  if (Date.now() > deadline) {
    console.error(`Timed out waiting for ${id} (last state: ${state}).`);
    process.exit(1);
  }
  await new Promise((r) => setTimeout(r, 3000));
  state = (await api(`/v13/deployments/${id}`)).body.readyState;
}
if (state !== 'READY') {
  console.error(`Deployment ${id} ended in ${state}.`);
  process.exit(1);
}

const url = `https://${res.body.url}`;
console.log(`${prod ? 'Production' : 'Preview'} deployment ready: ${url}`);
if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `url=${url}\n`);
if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, `Deployed: ${url}\n`);
