import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { loadConfig } from '../src/config.mjs';
import { contentHash } from '../src/dump.mjs';
import { isSafeUrl, slugify } from '../src/entities.mjs';
import { buildApi } from '../src/export.mjs';
import { createRelease, restoreRelease, verifyReleases } from '../src/releases.mjs';
import { assertSafeBinding, createServer } from '../src/server.mjs';
import { Store } from '../src/store.mjs';

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

let root;
let cfg;
let store;

const paper = (extra = {}) => ({ year: 2026, title: 'A test paper', authors: 'Zhang, Y., & Ma, N.', venue: 'Testing', doi: '10.1000/test.1', ...extra });

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'lab-backend-'));
  cfg = { ...loadConfig({ LAB_BACKEND_ROOT: root }), allowedHosts: [] };
  store = Store.open(cfg);
});

afterEach(() => {
  store.close();
  fs.rmSync(root, { recursive: true, force: true });
});

describe('store', () => {
  it('creates a row, writes its dump and logs a revision', () => {
    const row = store.create('publications', paper());
    assert.equal(row.title, 'A test paper');
    assert.match(fs.readFileSync(path.join(cfg.contentDir, 'publications.ndjson'), 'utf8'), /A test paper/);
    assert.equal(store.revisions({ entity: 'publications', id: row.id })[0].action, 'create');
    assert.match(fs.readFileSync(cfg.revisionsFile, 'utf8'), /"action":"create"/);
  });

  it('rejects bad input with per-field errors', () => {
    assert.throws(() => store.create('publications', { year: 'soon' }), (err) => {
      assert.equal(err.status, 400);
      assert.ok(err.fields.year && err.fields.title && err.fields.authors);
      return true;
    });
  });

  it('refuses javascript: URLs in link fields', () => {
    assert.equal(isSafeUrl('javascript:alert(1)'), false);
    assert.equal(isSafeUrl('https://doi.org/10.1/x'), true);
    assert.throws(() =>
      store.create('people', { name_en: 'X', role: 'phd', links: [{ label: 'x', url: 'javascript:alert(1)' }] }),
    );
  });

  it('refuses a duplicate DOI', () => {
    store.create('publications', paper());
    assert.throws(() => store.create('publications', paper({ title: 'Other' })), /doi/);
  });

  it('gives unique ids to items with the same slug', () => {
    const a = store.create('people', { name_en: 'Same Name', role: 'phd' });
    const b = store.create('people', { name_en: 'Same Name', role: 'phd' });
    assert.notEqual(a.id, b.id);
  });

  it('keeps Chinese-only titles addressable', () => {
    assert.equal(slugify('2026-水循环'), '2026-水循环');
    const row = store.create('news', { year: 2026, title_zh: '仅中文标题' });
    assert.ok(row.id.includes('仅中文标题'));
  });

  it('requires a news title in at least one language', () => {
    assert.throws(() => store.create('news', { year: 2026 }), /title_en/);
  });

  it('exports news by date, with undated items after dated items in their year', () => {
    const news = (id, year, date, sort_order) => store.create('news', { id, year, date, sort_order, title_en: id });
    news('older', 2026, '2026-08-26', 1);
    news('latest', 2026, '2026-10-27', 100);
    news('undated', 2026, '', 0);
    news('previous-year', 2025, '2025-12-31', 0);
    news('same-day', 2026, '2026-08-26', 2);
    assert.deepEqual(buildApi(store)['news.json'].items.map((n) => n.id), [
      'latest', 'older', 'same-day', 'undated', 'previous-year',
    ]);
  });

  it('preserves omitted fields on partial update', () => {
    const row = store.create('people', { name_en: 'A', role: 'phd', links: [{ label: 'Web', url: 'https://a.example' }] });
    const after = store.update('people', row.id, { research_field: 'ET' });
    assert.equal(after.links.length, 1);
    assert.equal(after.role, 'phd');
  });

  it('keeps bilingual people content through export and a database rebuild', () => {
    const row = store.create('people', {
      name_en: 'Ning Ma', name_zh: '马宁', role: 'co_pi',
      research_field: 'Hydrological Processes', research_field_zh: '水文过程',
      bio_en: 'Studies evapotranspiration.', bio_zh: '研究蒸散发。',
    });
    store.update('people', row.id, { email: 'person@example.com' });
    store.close();
    fs.rmSync(cfg.dbPath);
    store = Store.open(cfg);
    const person = buildApi(store)['people.json'].groups[0].members[0];
    assert.equal(person.research_field, 'Hydrological Processes');
    assert.equal(person.research_field_zh, '水文过程');
    assert.equal(person.bio_en, 'Studies evapotranspiration.');
    assert.equal(person.bio_zh, '研究蒸散发。');
    assert.equal(store.list('people', { q: '水文过程' }).length, 1);
  });

  it('rejects a reference to missing media and a wrong media type', () => {
    assert.throws(() => store.create('people', { name_en: 'A', role: 'phd', photo_id: 'missing' }), /photo_id/);
    const img = store.addMedia(PNG, { filename: 'x.png' });
    assert.throws(() => store.create('publications', paper({ pdf_id: img.id })), /pdf_id/);
  });
});

describe('archive', () => {
  it('hides archived items from the public API and restores them', () => {
    const row = store.create('publications', paper());
    assert.equal(buildApi(store)['publications.json'].count, 1);
    store.archive('publications', row.id);
    assert.equal(buildApi(store)['publications.json'].count, 0);
    assert.equal(store.get('publications', row.id).status, 'archived');
    store.unarchive('publications', row.id);
    assert.equal(buildApi(store)['publications.json'].count, 1);
  });

  it('never exposes drafts publicly', () => {
    store.create('publications', paper({ status: 'draft' }));
    assert.equal(buildApi(store)['publications.json'].count, 0);
  });

  it('only deletes archived items, and keeps them recoverable', () => {
    const row = store.create('publications', paper());
    assert.throws(() => store.remove('publications', row.id), /Archive an item/);
    store.archive('publications', row.id);
    store.remove('publications', row.id);
    assert.throws(() => store.get('publications', row.id), /No publications/);
    const deletion = store.revisions({ entity: 'publications', id: row.id })[0];
    assert.equal(deletion.action, 'delete');
    store.rollback(deletion.id);
    assert.equal(store.get('publications', row.id).title, 'A test paper');
  });

  it('rolls an edit back to its previous value', () => {
    const row = store.create('publications', paper());
    store.update('publications', row.id, { title: 'Wrong title' });
    const edit = store.revisions({ entity: 'publications', id: row.id })[0];
    store.rollback(edit.id);
    assert.equal(store.get('publications', row.id).title, 'A test paper');
  });

  it('deduplicates identical media and rejects disguised files', () => {
    const a = store.addMedia(PNG, { filename: 'a.png' });
    const b = store.addMedia(PNG, { filename: 'b.png' });
    assert.equal(a.id, b.id);
    assert.equal(store.listMedia({}).length, 1);
    assert.throws(() => store.addMedia(Buffer.from('<svg onload="alert(1)"></svg> padding padding')), /Unsupported/);
    assert.throws(() => store.addMedia(Buffer.from('<script>alert(1)</script>padding'), { filename: 'evil.png' }), /Unsupported/);
  });
});

describe('releases', () => {
  it('snapshots, skips unchanged content, and restores', () => {
    const row = store.create('publications', paper());
    const first = createRelease(store, { note: 'v1' });
    assert.equal(createRelease(store).skipped, true);

    store.update('publications', row.id, { title: 'Changed' });
    const result = restoreRelease(store, first.id);
    assert.equal(store.get('publications', row.id).title, 'A test paper');
    assert.notEqual(result.safetySnapshot, first.id, 'restore must first snapshot the current state');
    assert.equal(store.releases().length, 2);
  });

  it('detects a tampered archive', () => {
    store.create('publications', paper());
    const release = createRelease(store);
    fs.appendFileSync(path.join(cfg.releasesDir, release.file), 'tamper');
    assert.equal(verifyReleases(store)[0].ok, false);
    assert.throws(() => restoreRelease(store, release.id), /checksum/);
  });

  it('rejects path-like release ids', () => {
    assert.throws(() => restoreRelease(store, '../../etc/passwd'), /Invalid release id/);
  });
});

describe('durability', () => {
  it('rebuilds an identical database when the SQLite file is lost', () => {
    store.create('publications', paper());
    store.setSetting('site.test', { a: 1 });
    createRelease(store);
    const before = buildApi(store);
    store.close();
    fs.rmSync(cfg.dbPath);

    store = Store.open(cfg);
    assert.deepEqual(buildApi(store), before);
    assert.ok(store.revisions({}).length >= 2);
    assert.equal(store.releases().length, 1);
  });

  it('picks up content changed outside the server, as after git pull', () => {
    store.create('publications', paper());
    store.close();
    const file = path.join(cfg.contentDir, 'publications.ndjson');
    fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('A test paper', 'Pulled title'));

    store = Store.open(cfg);
    assert.equal(store.list('publications')[0].title, 'Pulled title');
  });

  it('hashes CRLF and LF checkouts identically', () => {
    store.create('publications', paper());
    const hash = contentHash(cfg.contentDir);
    const file = path.join(cfg.contentDir, 'publications.ndjson');
    fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace(/\n/g, '\r\n'));
    assert.equal(contentHash(cfg.contentDir), hash);
  });

  it('exports deterministically', () => {
    store.create('publications', paper());
    assert.equal(JSON.stringify(buildApi(store)), JSON.stringify(buildApi(store)));
  });
});

describe('http', () => {
  let server;
  let base;
  const hostHeader = () => new URL(base).host;

  const start = (overrides = {}) =>
    new Promise((resolve) => {
      server = createServer(store, { ...cfg, ...overrides });
      server.listen(0, '127.0.0.1', () => {
        base = `http://127.0.0.1:${server.address().port}`;
        resolve();
      });
    });

  afterEach(() => new Promise((resolve) => (server ? server.close(resolve) : resolve())));

  const json = (body) => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

  it('serves the public API with CORS and hides admin fields', async () => {
    await start();
    store.create('publications', paper());
    const res = await fetch(`${base}/api/v1/publications.json`);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('access-control-allow-origin'), '*');
    const body = await res.json();
    assert.equal(body.items[0].title, 'A test paper');
    assert.equal(body.items[0].status, undefined);
  });

  it('creates through the admin API', async () => {
    await start();
    const res = await fetch(`${base}/api/admin/entities/publications`, json(paper()));
    assert.equal(res.status, 201);
    assert.equal(store.list('publications').length, 1);
  });

  it('returns field errors as 400', async () => {
    await start();
    const res = await fetch(`${base}/api/admin/entities/publications`, json({}));
    assert.equal(res.status, 400);
    assert.ok((await res.json()).fields.title);
  });

  it('blocks cross-origin writes from another website', async () => {
    await start();
    const res = await fetch(`${base}/api/admin/entities/publications`, {
      ...json(paper()),
      headers: { 'Content-Type': 'application/json', Origin: 'https://evil.example' },
    });
    assert.equal(res.status, 403);
    assert.equal(store.list('publications').length, 0);
  });

  it('accepts same-origin writes', async () => {
    await start();
    const res = await fetch(`${base}/api/admin/entities/publications`, {
      ...json(paper()),
      headers: { 'Content-Type': 'application/json', Origin: base },
    });
    assert.equal(res.status, 201);
  });

  it('refuses form-encoded posts, which browsers send without preflight', async () => {
    await start();
    const res = await fetch(`${base}/api/admin/entities/publications`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(paper()),
    });
    assert.equal(res.status, 415);
  });

  it('blocks DNS rebinding through the Host header', async () => {
    await start();
    const http = await import('node:http');
    const status = await new Promise((resolve) => {
      http.get(`${base}/api/admin/status`, { headers: { Host: 'evil.example' } }, (r) => {
        r.resume();
        resolve(r.statusCode);
      });
    });
    assert.equal(status, 403);
  });

  it('requires the token when one is configured', async () => {
    await start({ adminToken: 'secret' });
    assert.equal((await fetch(`${base}/api/admin/status`)).status, 401);
    assert.equal((await fetch(`${base}/api/admin/status`, { headers: { Authorization: 'Bearer wrong' } })).status, 401);
    assert.equal((await fetch(`${base}/api/admin/status`, { headers: { Authorization: 'Bearer secret' } })).status, 200);
    assert.equal((await fetch(`${base}/api/v1/meta.json`)).status, 200, 'public API stays open');
  });

  it('refuses a network bind without a token', () => {
    assert.throws(() => assertSafeBinding({ host: '0.0.0.0', adminToken: '' }), /LAB_ADMIN_TOKEN/);
    assert.doesNotThrow(() => assertSafeBinding({ host: '0.0.0.0', adminToken: 'x' }));
    assert.doesNotThrow(() => assertSafeBinding({ host: '127.0.0.1', adminToken: '' }));
  });

  it('uploads media and serves the original by hash', async () => {
    await start();
    const up = await fetch(`${base}/api/admin/media?filename=dot.png`, { method: 'POST', body: PNG });
    assert.equal(up.status, 201);
    const row = await up.json();
    const res = await fetch(`${base}/media/${row.sha256}.png`);
    assert.equal(res.headers.get('content-type'), 'image/png');
    assert.deepEqual(Buffer.from(await res.arrayBuffer()), PNG);
  });

  it('does not let media or admin paths escape their directories', async () => {
    await start();
    assert.equal((await fetch(`${base}/media/..%2f..%2fpackage.json`)).status, 404);
    assert.equal((await fetch(`${base}/admin/..%2f..%2fpackage.json`)).status, 404);
    assert.equal((await fetch(`${base}/admin/%2e%2e/%2e%2e/package.json`)).status, 404);
  });

  it('answers unknown content types with 404, not a SQL error', async () => {
    await start();
    assert.equal((await fetch(`${base}/api/admin/entities/sqlite_master`)).status, 404);
    assert.equal((await fetch(`${base}/api/admin/entities/__proto__`)).status, 404);
  });

  it('keeps the CSP on admin pages', async () => {
    fs.mkdirSync(cfg.adminDir, { recursive: true });
    await start();
    const res = await fetch(`${base}/admin/index.html`);
    assert.match(res.headers.get('content-security-policy') ?? '', /default-src 'self'/);
    assert.ok(hostHeader());
  });
});
