/**
 * Zero-dependency static server for the crypto-core test harness.
 *
 *   npm run harness   →   http://127.0.0.1:3100/harness/
 *
 * Web Crypto (crypto.subtle) requires a secure context (127.0.0.1 or https).
 * Serves the module directory so the browser can import ES modules from /src and /test.
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const PORT = Number(process.env.PORT) || 3100;
const HOST = '127.0.0.1';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
};

const SECURITY_HEADERS = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    'font-src https://fonts.gstatic.com',
    "img-src 'self' blob: data:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
  ].join('; '),
};

function send(res, status, body, type = 'text/plain; charset=utf-8', extra = {}) {
  res.writeHead(status, { 'Content-Type': type, ...SECURITY_HEADERS, ...extra });
  res.end(body);
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', `http://${HOST}:${PORT}`);
    const pathname = decodeURIComponent(url.pathname);
    if (pathname === '/') return send(res, 302, '', undefined, { Location: '/harness/' });

    let filePath = resolve(ROOT, `.${pathname}`);
    if (filePath !== ROOT && !filePath.startsWith(ROOT + sep)) return send(res, 403, 'Forbidden');

    let info = await stat(filePath).catch(() => null);
    if (info?.isDirectory()) {
      if (!pathname.endsWith('/')) return send(res, 301, '', undefined, { Location: `${pathname}/` });
      filePath = join(filePath, 'index.html');
      info = await stat(filePath).catch(() => null);
    }
    if (!info?.isFile()) return send(res, 404, 'Not found');

    const body = await readFile(filePath);
    send(res, 200, body, MIME[extname(filePath)] ?? 'application/octet-stream');
  } catch (err) {
    console.error(err);
    send(res, 500, 'Internal error');
  }
});

server.listen(PORT, HOST, () => {
  console.log(`\n  🔐 Crypto Core Test UI running at: http://${HOST}:${PORT}/harness/\n`);
});
