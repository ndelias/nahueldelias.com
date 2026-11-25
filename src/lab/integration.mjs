// The design lab, added only when the dev server runs (`astro dev`): a
// production build never sees src/lab/page.astro, so none of its pages,
// scripts or images reach dist/.
//
// Two things: the route (/_lab), and the editor's Save (POST /__lab/save),
// which writes a layout's settings to src/settings/<layout>.json.
// The layout renders from that file, so what was on screen is now in the
// code, and Vite reloads the page from it.
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const ID = /^[a-z0-9-]{1,40}$/;
const MAX_BODY = 64 * 1024;

/** Only the shape the layouts read; anything else is dropped. */
function clean(body) {
  const out = {};
  if (Array.isArray(body.order)) out.order = body.order.filter((k) => typeof k === 'string' && ID.test(k));
  if (body.values && typeof body.values === 'object') {
    out.values = Object.fromEntries(
      Object.entries(body.values).filter(([k, v]) => ID.test(k) && typeof v === 'number' && Number.isFinite(v)),
    );
  }
  if (body.text && typeof body.text === 'object') {
    out.text = Object.fromEntries(
      Object.entries(body.text)
        .filter(([k, v]) => ID.test(k) && typeof v === 'string')
        .map(([k, v]) => [k, v.replace(/\s+/g, ' ').trim().slice(0, 2000)]),
    );
  }
  return out;
}

/** @returns {import('astro').AstroIntegration} */
export default function lab() {
  let root;
  return {
    name: 'design-lab',
    hooks: {
      'astro:config:setup': ({ command, config, injectRoute }) => {
        root = config.root;
        if (command === 'dev') injectRoute({ pattern: '/_lab/[...path]', entrypoint: './src/lab/page.astro' });
      },
      'astro:server:setup': ({ server }) => {
        const dir = fileURLToPath(new URL('src/settings/', root));
        server.middlewares.use('/__lab/save', (req, res) => {
          const reply = (status, body) => {
            res.statusCode = status;
            res.setHeader('content-type', 'application/json');
            res.end(JSON.stringify(body));
          };
          if (req.method !== 'POST') return reply(405, { error: 'POST only' });
          let raw = '';
          req.on('data', (chunk) => {
            raw += chunk;
            if (raw.length > MAX_BODY) req.destroy();
          });
          req.on('end', async () => {
            try {
              const body = JSON.parse(raw);
              if (!ID.test(body.id ?? '')) return reply(400, { error: 'bad layout id' });
              await mkdir(dir, { recursive: true });
              await writeFile(`${dir}${body.id}.json`, JSON.stringify(clean(body), null, 2) + '\n');
              reply(200, { saved: `src/settings/${body.id}.json` });
            } catch (error) {
              reply(400, { error: String(error) });
            }
          });
        });
      },
    },
  };
}
