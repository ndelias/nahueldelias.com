// Shared by tests/dist/*.test.mjs and scripts/screens.mjs: a static HTTP
// server for a directory (pages are always checked over HTTP, never file://)
// and a headless Chrome.
//
// Chrome is the installed Google Chrome, the same one Lighthouse uses in CI,
// driven by playwright-core (no browser download). CHROME_PATH overrides it.

import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, sep } from 'node:path';
import { chromium } from 'playwright-core';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
};

/** Serve `dir` on a free port. Resolves to { origin, close }. */
export function serve(dir) {
  const root = normalize(dir + sep);
  const server = createServer((req, res) => {
    let file = normalize(join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname)));
    if (!file.startsWith(root)) return res.writeHead(403).end();
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
    if (!existsSync(file)) return res.writeHead(404).end();
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
    createReadStream(file).pipe(res);
  });
  return new Promise((done) =>
    server.listen(0, '127.0.0.1', () =>
      done({ origin: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((r) => server.close(r)) }),
    ),
  );
}

export const launch = () =>
  chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : { channel: 'chrome' });
