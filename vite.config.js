import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Vite does not serve the Vercel functions in /api on its own, so this small
 * middleware mounts every api/<name>.js file on the dev server using the same
 * `(req, res)` contract Vercel uses. That makes the email endpoint testable
 * locally with `npm run dev` (an alternative is `npx vercel dev`).
 *
 * Server-only secrets are read from process.env inside the handler and are
 * never bundled into the browser build (Vite only inlines VITE_* variables).
 */
function localApiFunctions() {
  const readBody = (req) =>
    new Promise((resolve, reject) => {
      let raw = '';
      req.on('data', (chunk) => {
        raw += chunk;
        if (raw.length > 1e6) reject(new Error('Request body too large'));
      });
      req.on('end', () => resolve(raw));
      req.on('error', reject);
    });

  return {
    name: 'local-api-functions',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url || '';
        if (!url.startsWith('/api/')) return next();

        const route = url.split('?')[0].replace(/^\/api\//, '');
        if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(route)) return next();

        const file = path.resolve(process.cwd(), 'api', `${route}.js`);
        if (!fs.existsSync(file)) {
          res.statusCode = 404;
          return res.end(JSON.stringify({ error: `No such API route: /api/${route}` }));
        }

        try {
          const mod = await server.ssrLoadModule(`/api/${route}.js`);
          res.status = (code) => {
            res.statusCode = code;
            return res;
          };
          res.json = (payload) => {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(payload));
            return res;
          };

          if (req.method && !['GET', 'HEAD', 'OPTIONS'].includes(req.method.toUpperCase())) {
            const raw = await readBody(req);
            if (String(req.headers['content-type'] || '').includes('application/json')) {
              try {
                req.body = raw ? JSON.parse(raw) : {};
              } catch {
                res.statusCode = 400;
                return res.end(JSON.stringify({ error: 'Invalid JSON body' }));
              }
            } else {
              req.body = raw;
            }
          } else {
            req.body = {};
          }

          await mod.default(req, res);
        } catch (error) {
          console.error(`[api/${route}]`, error);
          if (!res.headersSent) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
          }
          res.end(JSON.stringify({ error: error?.message || 'Internal server error' }));
        }
      });
    },
  };
}

/** Placeholder values copied straight from .env.example - never real credentials. */
const PLACEHOLDER_MARKERS = ['your-project-ref', 'your-anon'];

/**
 * Vite inlines VITE_* variables at build time, so a build that runs without the
 * Supabase pair produces a site that renders but cannot load anything: the header
 * shows the "Setup needed" banner and every product list shows
 * "Supabase is not configured yet...". That is a deployment problem, not a code
 * problem, so fail the build loudly with the missing names - exactly like
 * api/send-order-email.js already does for its own config.
 *
 * Dev is never blocked (the banner is useful there). Set
 * ALLOW_MISSING_SUPABASE_ENV=1 to build anyway (e.g. a CSS-only check).
 */
function assertBuildEnv(command, mode) {
  if (command !== 'build' || process.env.ALLOW_MISSING_SUPABASE_ENV === '1') return;

  const required = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'];
  const missing = [];
  const placeholder = [];

  for (const key of required) {
    const value = String(process.env[key] ?? '').trim();
    if (!value) missing.push(key);
    else if (PLACEHOLDER_MARKERS.some((marker) => value.includes(marker))) placeholder.push(key);
  }

  if (missing.length === 0 && placeholder.length === 0) return;

  const problems = [];
  if (missing.length) problems.push(`missing: ${missing.join(', ')}`);
  if (placeholder.length) problems.push(`still the .env.example placeholder: ${placeholder.join(', ')}`);

  throw new Error(
    `Cannot build the "${mode}" bundle - Supabase is not configured (${problems.join('; ')}).\n` +
      'Vite bakes VITE_* values into the bundle at build time, so they must exist\n' +
      'WHERE THE BUILD RUNS, not just on your machine.\n' +
      '  - Locally: copy .env.example to .env, fill in the keys, run npm run build.\n' +
      '  - Vercel: Project -> Settings -> Environment Variables -> add both keys for\n' +
      '    Production AND Preview, then REDEPLOY (adding env vars alone does not rebuild).\n' +
      'Set ALLOW_MISSING_SUPABASE_ENV=1 to build without them.',
  );
}

export default defineConfig(({ command, mode }) => {
  // Load every .env entry (empty prefix = no filtering) so the /api handlers
  // can read server-only secrets during local development.
  const env = loadEnv(mode, process.cwd(), '');
  for (const [key, value] of Object.entries(env)) {
    if (process.env[key] === undefined) process.env[key] = value;
  }

  assertBuildEnv(command, mode);

  return {
    plugins: [react(), localApiFunctions()],
    server: { port: Number(process.env.PORT) || 5173, host: true },
    preview: { port: 4173, host: true },
    build: { outDir: 'dist', sourcemap: false },
  };
});
