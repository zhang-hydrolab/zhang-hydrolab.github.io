import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadConfig } from './config.mjs';
import { ENTITIES, ROLES, STATUSES } from './entities.mjs';
import { buildApi } from './export.mjs';
import { MAX_UPLOAD_BYTES, mediaPath } from './media.mjs';
import { createRelease, restoreRelease, verifyReleases } from './releases.mjs';
import { Store } from './store.mjs';

const MAX_JSON_BYTES = 2 * 1024 * 1024;
const LOOPBACK = new Set(['127.0.0.1', '::1', 'localhost']);
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
};
const ADMIN_CSP = "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'";

const httpError = (status, message) => Object.assign(new Error(message), { status });

function send(res, status, body, headers = {}) {
  const payload = Buffer.isBuffer(body) ? body : Buffer.from(typeof body === 'string' ? body : JSON.stringify(body));
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': payload.length,
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    ...headers,
  });
  res.end(payload);
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(httpError(413, 'Request body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function readJson(req) {
  if (!String(req.headers['content-type'] ?? '').startsWith('application/json')) {
    throw httpError(415, 'Expected application/json');
  }
  const raw = await readBody(req, MAX_JSON_BYTES);
  try {
    return raw.length ? JSON.parse(raw.toString('utf8')) : {};
  } catch {
    throw httpError(400, 'Malformed JSON');
  }
}

function safeEqual(a, b) {
  const left = crypto.createHash('sha256').update(String(a)).digest();
  const right = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(left, right);
}

/**
 * A browser on this machine can reach loopback from any website, so a local
 * bind alone is not a defence. Requests must name an expected host (blocks DNS
 * rebinding), and state-changing requests must come from our own origin.
 */
function guardRequest(req, cfg) {
  const hostname = String(req.headers.host ?? '').replace(/:\d+$/, '').replace(/^\[|\]$/g, '').toLowerCase();
  const allowed = new Set([...LOOPBACK, cfg.host.toLowerCase(), ...cfg.allowedHosts]);
  if (!allowed.has(hostname)) throw httpError(403, 'Unexpected Host header');

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    const origin = req.headers.origin;
    if (origin) {
      let originHost;
      try {
        originHost = new URL(origin).host.toLowerCase();
      } catch {
        throw httpError(403, 'Invalid Origin');
      }
      if (originHost !== String(req.headers.host).toLowerCase()) throw httpError(403, 'Cross-origin request refused');
    }
    const site = req.headers['sec-fetch-site'];
    if (site && !['same-origin', 'none'].includes(site)) throw httpError(403, 'Cross-site request refused');
  }
}

function requireAdmin(req, cfg) {
  if (!cfg.adminToken) return;
  const header = String(req.headers.authorization ?? '');
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!safeEqual(token, cfg.adminToken)) throw httpError(401, 'Admin token required');
}

/** Header values must be Latin-1, so the admin URI-encodes names such as 张永强. */
function readAuthor(header) {
  const value = String(header ?? 'admin');
  try {
    return decodeURIComponent(value).slice(0, 80);
  } catch {
    return value.slice(0, 80);
  }
}

function serveStatic(res, dir, relative, headers = {}) {
  const resolved = path.resolve(dir, `.${path.posix.normalize(`/${relative}`)}`);
  if (resolved !== dir && !resolved.startsWith(dir + path.sep)) throw httpError(404, 'Not found');
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) throw httpError(404, 'Not found');
  const type = MIME[path.extname(resolved)] ?? 'application/octet-stream';
  send(res, 200, fs.readFileSync(resolved), { 'Content-Type': type, 'Cache-Control': 'no-cache', ...headers });
}

function fieldSchema(field) {
  const { name, label, type, required, options, help, accept, ref, multiline } = field;
  return { name, label, type, required: Boolean(required), options, help, accept, ref, multiline: Boolean(multiline), default: field.default };
}

function schemaPayload() {
  return {
    statuses: STATUSES,
    roles: ROLES,
    entities: Object.entries(ENTITIES).map(([key, def]) => ({ key, label: def.label, fields: def.fields.map(fieldSchema) })),
  };
}

/** Looks up a DOI on Crossref so a new paper needs only its DOI. */
async function lookupDoi(doi) {
  const clean = String(doi ?? '').trim().replace(/^https?:\/\/(dx\.)?doi\.org\//i, '');
  if (!/^10\.\d{4,9}\/\S+$/.test(clean)) throw httpError(400, 'That does not look like a DOI');
  const response = await fetch(`https://api.crossref.org/works/${encodeURIComponent(clean)}`, {
    headers: { 'User-Agent': 'zhang-hydrolab-admin/1.0 (https://zhang-hydrolab.github.io/)' },
    signal: AbortSignal.timeout(15000),
  });
  if (response.status === 404) throw httpError(404, 'Crossref has no record for this DOI');
  if (!response.ok) throw httpError(502, `Crossref returned ${response.status}`);
  const { message: m } = await response.json();
  const given = (a) => (a.given ?? '').split(/[\s-]+/).filter(Boolean).map((p) => `${p[0].toUpperCase()}.`).join(' ');
  const names = (m.author ?? []).map((a) => (a.family ? [a.family, given(a)].filter(Boolean).join(', ') : a.name)).filter(Boolean);
  const authors = names.length > 1 ? `${names.slice(0, -1).join(', ')}, & ${names.at(-1)}` : (names[0] ?? '');
  const year = m.issued?.['date-parts']?.[0]?.[0] ?? m.created?.['date-parts']?.[0]?.[0] ?? null;
  return {
    doi: clean,
    title: (m.title?.[0] ?? '').replace(/<[^>]+>/g, '').trim(),
    authors,
    venue: m['container-title']?.[0] ?? '',
    volume: m.volume ?? '',
    issue: m.issue ?? '',
    pages: m.page ?? m['article-number'] ?? '',
    year,
  };
}

let publishing = false;

function runPublish(cfg, note) {
  if (publishing) throw httpError(409, 'A publish is already running');
  const script = path.join(cfg.projectRoot, 'scripts', 'publish.mjs');
  publishing = true;
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', script, '--note', note || 'Published from admin'], { cwd: cfg.projectRoot });
    let log = '';
    child.stdout.on('data', (d) => (log += d));
    child.stderr.on('data', (d) => (log += d));
    child.on('error', (err) => {
      publishing = false;
      reject(err);
    });
    child.on('close', (code) => {
      publishing = false;
      if (code === 0) resolve({ ok: true, log });
      else reject(Object.assign(httpError(500, `Publish failed (exit ${code})`), { log }));
    });
  });
}

function createRouter(store, cfg) {
  const routes = [];
  const on = (method, pattern, handler, { admin = true } = {}) => {
    const keys = [];
    const regex = new RegExp(`^${pattern.replace(/:([a-z_]+)/g, (_, k) => (keys.push(k), '([^/]+)'))}$`);
    routes.push({ method, regex, keys, handler, admin });
  };

  on('GET', '/healthz', () => ({ ok: true, service: 'zhang-hydrolab-backend' }), { admin: false });

  on('GET', '/api/admin/schema', () => schemaPayload());
  on('GET', '/api/admin/status', () => store.status());

  on('GET', '/api/admin/entities/:entity', ({ params, query }) =>
    store.list(params.entity, { status: query.get('status') || 'all', q: query.get('q') || undefined, limit: query.get('limit') || 2000 }),
  );
  on('GET', '/api/admin/entities/:entity/:id', ({ params }) => store.describe(params.entity, params.id));
  on('POST', '/api/admin/entities/:entity', async ({ req, params, author }) => [201, store.create(params.entity, await readJson(req), { author })]);
  on('PUT', '/api/admin/entities/:entity/:id', async ({ req, params, author }) => store.update(params.entity, params.id, await readJson(req), { author }));
  on('POST', '/api/admin/entities/:entity/:id/archive', ({ params, author }) => store.archive(params.entity, params.id, { author }));
  on('POST', '/api/admin/entities/:entity/:id/unarchive', ({ params, author }) => store.unarchive(params.entity, params.id, { author }));
  on('DELETE', '/api/admin/entities/:entity/:id', ({ params, author }) => store.remove(params.entity, params.id, { author }));

  on('GET', '/api/admin/revisions', ({ query }) =>
    store.revisions({ entity: query.get('entity') || undefined, id: query.get('id') || undefined, limit: query.get('limit') || 100 }),
  );
  on('POST', '/api/admin/revisions/:id/rollback', ({ params, author }) => store.rollback(params.id, { author }));

  on('GET', '/api/admin/settings', () => store.settings());
  on('PUT', '/api/admin/settings/:key', async ({ req, params, author }) => {
    const body = await readJson(req);
    return store.setSetting(params.key, body.value, { author });
  });

  on('GET', '/api/admin/media', ({ query }) => store.listMedia({ q: query.get('q') || undefined, status: query.get('status') || 'published' }));
  on('POST', '/api/admin/media', async ({ req, query, author }) => {
    const buffer = await readBody(req, MAX_UPLOAD_BYTES + 1);
    return [201, store.addMedia(buffer, { filename: query.get('filename') || 'upload', alt_en: query.get('alt_en') || '', alt_zh: query.get('alt_zh') || '' }, { author })];
  });
  on('PUT', '/api/admin/media/:id', async ({ req, params, author }) => store.updateMedia(params.id, await readJson(req), { author }));

  on('POST', '/api/admin/lookup-doi', async ({ req }) => lookupDoi((await readJson(req)).doi));

  on('GET', '/api/admin/releases', () => store.releases());
  on('GET', '/api/admin/releases/verify', () => verifyReleases(store));
  on('POST', '/api/admin/releases', async ({ req }) => [201, createRelease(store, { note: (await readJson(req)).note ?? '' })]);
  on('POST', '/api/admin/releases/:id/restore', ({ params }) => restoreRelease(store, params.id));
  on('POST', '/api/admin/publish', async ({ req }) => {
    const result = await runPublish(cfg, (await readJson(req)).note);
    // The child process wrote releases and revisions through its own connection.
    store.rebuildFromContent();
    return result;
  });

  return routes;
}

export function createServer(store, cfg) {
  const routes = createRouter(store, cfg);

  return http.createServer(async (req, res) => {
    try {
      guardRequest(req, cfg);
      const url = new URL(req.url, 'http://localhost');
      const pathname = decodeURIComponent(url.pathname);

      if (pathname === '/') {
        res.writeHead(302, { Location: '/admin/' }).end();
        return;
      }

      // Public read-only API: same bodies as the published /api/v1/*.json files.
      const api = pathname.match(/^\/api\/v1\/([a-z]+\.json)$/);
      if (api && (req.method === 'GET' || req.method === 'HEAD')) {
        const body = buildApi(store)[api[1]];
        if (!body) throw httpError(404, 'Not found');
        send(res, 200, body, { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-cache' });
        return;
      }

      const media = pathname.match(/^\/media\/([0-9a-f]{64})\.([a-z0-9]{2,5})$/);
      if (media && req.method === 'GET') {
        const row = store.getMedia(media[1].slice(0, 16));
        if (row.sha256 !== media[1] || row.ext !== media[2]) throw httpError(404, 'Not found');
        send(res, 200, fs.readFileSync(mediaPath(cfg, row.sha256, row.ext)), {
          'Content-Type': row.mime,
          'Cache-Control': 'public, max-age=31536000, immutable',
          'Access-Control-Allow-Origin': '*',
        });
        return;
      }

      if (pathname === '/admin') {
        res.writeHead(302, { Location: '/admin/' }).end();
        return;
      }
      if (pathname.startsWith('/admin/') && req.method === 'GET') {
        const relative = pathname.slice('/admin/'.length) || 'index.html';
        serveStatic(res, cfg.adminDir, relative, { 'Content-Security-Policy': ADMIN_CSP, 'X-Frame-Options': 'DENY' });
        return;
      }

      for (const route of routes) {
        if (route.method !== req.method) continue;
        const match = pathname.match(route.regex);
        if (!match) continue;
        if (route.admin) requireAdmin(req, cfg);
        const params = Object.fromEntries(route.keys.map((key, i) => [key, match[i + 1]]));
        const author = readAuthor(req.headers['x-lab-author']);
        const result = await route.handler({ req, params, query: url.searchParams, author });
        if (Array.isArray(result) && typeof result[0] === 'number') send(res, result[0], result[1]);
        else send(res, 200, result);
        return;
      }
      throw httpError(404, 'Not found');
    } catch (err) {
      const status = err.status ?? 500;
      if (status >= 500) console.error(err);
      send(res, status, { error: status >= 500 && !err.log ? 'Internal server error' : err.message, fields: err.fields, log: err.log });
    }
  });
}

function assertSafeBinding(cfg) {
  if (!LOOPBACK.has(cfg.host) && !cfg.adminToken) {
    throw new Error(`Refusing to bind ${cfg.host} without LAB_ADMIN_TOKEN: the admin API would be open to the network.`);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const cfg = { ...loadConfig(), allowedHosts: (process.env.LAB_ALLOWED_HOSTS ?? '').split(',').map((h) => h.trim().toLowerCase()).filter(Boolean) };
  assertSafeBinding(cfg);
  const store = Store.open(cfg);
  createServer(store, cfg).listen(cfg.port, cfg.host, () => {
    console.log(`Admin:      http://${cfg.host}:${cfg.port}/admin/`);
    console.log(`Public API: http://${cfg.host}:${cfg.port}/api/v1/meta.json`);
    console.log(`Database:   ${cfg.dbPath}`);
  });
}

export { assertSafeBinding };
