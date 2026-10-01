/**
 * Serves the static export (web/out) the way a static host does, for the Playwright suite:
 * the export lives under BASE_PATH (default /next), a directory serves its index.html, a missing
 * file is the export's 404.html with a 404 status, and nothing is cached. No dependency, no
 * rewrites: a path that does not exist is a 404, as it is on the real host.
 *
 * Usage: node tests/e2e/serve.mjs   (PORT, default 4173; BASE_PATH, default /next)
 */
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../out');
const basePath = process.env.BASE_PATH ?? '/next';
const port = Number(process.env.PORT ?? 4173);
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png', '.txt': 'text/plain; charset=utf-8', '.ico': 'image/x-icon' };

async function send(res, status, file) {
  const body = await readFile(file);
  res.writeHead(status, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
  res.end(body);
}

http.createServer(async (req, res) => {
  const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  try {
    if (url === '/') { res.writeHead(302, { location: `${basePath}/` }); return res.end(); }
    if (url === basePath || url.startsWith(`${basePath}/`)) {
      let rel = url.slice(basePath.length);
      if (rel === '' ) { res.writeHead(301, { location: `${basePath}/` }); return res.end(); }
      if (rel.endsWith('/')) rel += 'index.html';
      const file = path.join(root, rel);
      if (file.startsWith(root + path.sep)) {
        try { return await send(res, 200, file); } catch { /* falls through to the 404 page */ }
      }
    }
    return await send(res, 404, path.join(root, '404.html'));
  } catch {
    res.writeHead(500).end('server error');
  }
}).listen(port, '127.0.0.1', () => console.log(`serving ${root} at http://127.0.0.1:${port}${basePath}/`));
