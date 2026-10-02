import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Vite does not serve the Vercel functions in /api on its own, so this small
 * middleware mounts every api/<name>.js file on the dev server using the same
 * `(req, res)` contract Vercel uses. That makes the Mailgun endpoint testable
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

export default defineConfig(({ mode }) => {
  // Load every .env entry (empty prefix = no filtering) so the /api handlers
  // can read server-only secrets during local development.
  const env = loadEnv(mode, process.cwd(), '');
  for (const [key, value] of Object.entries(env)) {
    if (process.env[key] === undefined) process.env[key] = value;
  }

  return {
    plugins: [react(), localApiFunctions()],
    server: { port: Number(process.env.PORT) || 5173, host: true },
    preview: { port: 4173, host: true },
    build: { outDir: 'dist', sourcemap: false },
  };
});
