import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { contentHash, dumpAll, dumpTable, parseRows, readContentFiles, replaceContent } from './dump.mjs';
import { ENTITIES, STATUSES, ValidationError, cleanInput, isJsonField, slugify } from './entities.mjs';
import { storeFile } from './media.mjs';

const httpError = (status, message) => Object.assign(new Error(message), { status });
const now = () => new Date().toISOString();
const newId = () => `${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}`;

function requireEntity(entity) {
  const def = Object.hasOwn(ENTITIES, entity) ? ENTITIES[entity] : null;
  if (!def) throw httpError(404, `Unknown content type: ${entity}`);
  return def;
}

function decode(def, row) {
  if (!row) return row;
  const out = { ...row };
  for (const field of def.fields) if (isJsonField(field)) out[field.name] = JSON.parse(row[field.name] || '[]');
  return out;
}

function encode(def, row) {
  const out = { ...row };
  for (const field of def.fields) if (isJsonField(field)) out[field.name] = JSON.stringify(row[field.name] ?? []);
  return out;
}

const withListing = (def, row) => ({ ...row, _title: def.title(row), _subtitle: def.subtitle(row) });

export class Store {
  static open(cfg) {
    fs.mkdirSync(path.dirname(cfg.dbPath), { recursive: true });
    fs.mkdirSync(cfg.contentDir, { recursive: true });
    fs.mkdirSync(cfg.mediaDir, { recursive: true });
    fs.mkdirSync(cfg.releasesDir, { recursive: true });

    const db = new DatabaseSync(cfg.dbPath);
    db.exec('PRAGMA foreign_keys = ON');
    db.exec('PRAGMA busy_timeout = 10000');
    // Rollback journal rather than WAL: the repository may live in a synced
    // folder, where WAL side files are unsafe.
    db.exec('PRAGMA journal_mode = DELETE');
    const store = new Store(db, cfg);
    store.#migrate();
    store.#syncWithContent();
    return store;
  }

  constructor(db, cfg) {
    this.db = db;
    this.cfg = cfg;
  }

  close() {
    this.db.close();
  }

  #migrate() {
    const { db, cfg } = this;
    db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL);
             CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);`);
    const applied = new Set(db.prepare('SELECT name FROM schema_migrations').all().map((r) => r.name));
    for (const name of fs.readdirSync(cfg.migrationsDir).filter((f) => f.endsWith('.sql')).sort()) {
      if (applied.has(name)) continue;
      this.tx(() => {
        db.exec(fs.readFileSync(path.join(cfg.migrationsDir, name), 'utf8'));
        db.prepare('INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)').run(name, now());
      });
    }
  }

  /** Reloads the database when the committed content changed, e.g. after `git pull`. */
  #syncWithContent() {
    const hash = contentHash(this.cfg.contentDir);
    if (this.#meta('content_hash') !== hash) this.rebuildFromContent();
  }

  rebuildFromContent() {
    const { db, cfg } = this;
    const tables = readContentFiles(cfg);
    this.tx(() => {
      replaceContent(db, tables);
      db.exec('DELETE FROM revisions');
      db.exec('DELETE FROM releases');
      if (fs.existsSync(cfg.revisionsFile)) {
        const insert = db.prepare(
          `INSERT OR IGNORE INTO revisions (id, entity, entity_id, action, before, after, author, note, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        );
        for (const r of parseRows(fs.readFileSync(cfg.revisionsFile, 'utf8'))) {
          insert.run(r.id, r.entity, r.entity_id, r.action, r.before, r.after, r.author, r.note, r.created_at);
        }
      }
      const index = path.join(cfg.releasesDir, 'index.ndjson');
      if (fs.existsSync(index)) {
        const insert = db.prepare(
          `INSERT OR IGNORE INTO releases (id, created_at, note, content_hash, counts, file, bytes, sha256)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        );
        for (const r of parseRows(fs.readFileSync(index, 'utf8'))) {
          insert.run(r.id, r.created_at, r.note, r.content_hash, JSON.stringify(r.counts ?? {}), r.file, r.bytes, r.sha256);
        }
      }
      this.#setMeta('content_hash', contentHash(cfg.contentDir));
    });
  }

  #meta(key) {
    return this.db.prepare('SELECT value FROM meta WHERE key = ?').get(key)?.value ?? null;
  }

  #setMeta(key, value) {
    this.db.prepare('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value);
  }

  tx(fn) {
    const { db } = this;
    if (this.inTx) return fn();
    this.inTx = true;
    db.exec('BEGIN IMMEDIATE');
    try {
      const result = fn();
      db.exec('COMMIT');
      return result;
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    } finally {
      this.inTx = false;
    }
  }

  #log(entity, entityId, action, before, after, { author = 'admin', note = '' } = {}) {
    const row = {
      id: newId(),
      entity,
      entity_id: entityId,
      action,
      before: before ? JSON.stringify(before) : null,
      after: after ? JSON.stringify(after) : null,
      author,
      note,
      created_at: now(),
    };
    this.db
      .prepare(`INSERT INTO revisions (id, entity, entity_id, action, before, after, author, note, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(...Object.values(row));
    return row;
  }

  /** Runs a mutation, then persists the touched table and its audit entries. */
  #commit(tables, fn) {
    const { db, cfg } = this;
    const pending = [];
    const original = this.#log.bind(this);
    const log = (...args) => {
      const row = original(...args);
      pending.push(row);
      return row;
    };
    const result = this.tx(() => fn(log));
    for (const table of tables) dumpTable(db, cfg, table);
    if (pending.length) {
      fs.appendFileSync(cfg.revisionsFile, `${pending.map((r) => JSON.stringify(r)).join('\n')}\n`);
    }
    this.#setMeta('content_hash', contentHash(cfg.contentDir));
    return result;
  }

  list(entity, { status, q, limit = 1000, offset = 0 } = {}) {
    const def = requireEntity(entity);
    const where = [];
    const params = [];
    if (status && status !== 'all') {
      if (!STATUSES.includes(status)) throw httpError(400, 'Unknown status');
      where.push('status = ?');
      params.push(status);
    }
    if (q) {
      where.push(`(${def.search.map((c) => `"${c}" LIKE ?`).join(' OR ')})`);
      params.push(...def.search.map(() => `%${q}%`));
    }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const rows = this.db
      .prepare(`SELECT * FROM "${def.table}" ${clause} ORDER BY ${def.order} LIMIT ? OFFSET ?`)
      .all(...params, Number(limit), Number(offset));
    return rows.map((row) => withListing(def, decode(def, row)));
  }

  count(entity, status = 'published') {
    const def = requireEntity(entity);
    return this.db.prepare(`SELECT COUNT(*) AS n FROM "${def.table}" WHERE status = ?`).get(status).n;
  }

  /** One record with its display title. Kept apart from get(), whose rows go into revisions. */
  describe(entity, id) {
    return withListing(requireEntity(entity), this.get(entity, id));
  }

  get(entity, id) {
    const def = requireEntity(entity);
    const row = this.db.prepare(`SELECT * FROM "${def.table}" WHERE id = ?`).get(id);
    if (!row) throw httpError(404, `No ${entity} with id ${id}`);
    return decode(def, row);
  }

  #exists(table, id) {
    return Boolean(this.db.prepare(`SELECT 1 FROM "${table}" WHERE id = ?`).get(id));
  }

  #checkReferences(def, row) {
    const errors = {};
    for (const field of def.fields) {
      const value = row[field.name];
      if (!value) continue;
      if (field.type === 'media') {
        const media = this.db.prepare('SELECT mime FROM media WHERE id = ?').get(value);
        if (!media) errors[field.name] = 'media item does not exist';
        else if (field.accept === 'pdf' && media.mime !== 'application/pdf') errors[field.name] = 'must be a PDF';
        else if (field.accept === 'image' && !media.mime.startsWith('image/')) errors[field.name] = 'must be an image';
      }
      if (field.type === 'ref' && !this.#exists(ENTITIES[field.ref].table, value)) {
        errors[field.name] = 'referenced item does not exist';
      }
    }
    if (Object.keys(errors).length) throw new ValidationError(errors);
  }

  #uniqueId(def, row, requested) {
    const base = slugify(requested || def.slugFrom(row));
    let id = base;
    for (let n = 2; this.#exists(def.table, id); n += 1) id = `${base}-${n}`;
    return id;
  }

  #checkDoi(def, row, id) {
    if (def.table !== 'publications' || !row.doi) return;
    const dup = this.db.prepare('SELECT id FROM publications WHERE doi = ? AND id <> ?').get(row.doi, id ?? '');
    if (dup) throw new ValidationError({ doi: `already used by ${dup.id}` });
  }

  create(entity, input, opts = {}) {
    const def = requireEntity(entity);
    const clean = cleanInput(entity, input);
    this.#checkReferences(def, clean);
    this.#checkDoi(def, clean);
    const status = STATUSES.includes(input.status) ? input.status : 'published';
    const stamp = now();
    const row = {
      id: this.#uniqueId(def, clean, input.id),
      ...encode(def, clean),
      status,
      created_at: input.created_at ?? stamp,
      updated_at: input.updated_at ?? stamp,
      archived_at: status === 'archived' ? stamp : null,
    };
    const keys = Object.keys(row);
    return this.#commit([def.table], (log) => {
      this.db
        .prepare(`INSERT INTO "${def.table}" (${keys.map((k) => `"${k}"`).join(',')}) VALUES (${keys.map(() => '?').join(',')})`)
        .run(...keys.map((k) => row[k]));
      const created = this.get(entity, row.id);
      log(entity, row.id, 'create', null, created, opts);
      return created;
    });
  }

  update(entity, id, input, opts = {}) {
    const def = requireEntity(entity);
    const before = this.get(entity, id);
    const clean = cleanInput(entity, input, before);
    this.#checkReferences(def, clean);
    this.#checkDoi(def, clean, id);
    const row = encode(def, clean);
    const status = STATUSES.includes(input.status) ? input.status : before.status;
    const keys = Object.keys(row);
    return this.#commit([def.table], (log) => {
      this.db
        .prepare(`UPDATE "${def.table}" SET ${keys.map((k) => `"${k}" = ?`).join(', ')}, status = ?, updated_at = ?,
                  archived_at = ? WHERE id = ?`)
        .run(...keys.map((k) => row[k]), status, now(), status === 'archived' ? (before.archived_at ?? now()) : null, id);
      const after = this.get(entity, id);
      log(entity, id, 'update', before, after, opts);
      return after;
    });
  }

  #setStatus(entity, id, status, action, opts) {
    const def = requireEntity(entity);
    const before = this.get(entity, id);
    return this.#commit([def.table], (log) => {
      this.db
        .prepare(`UPDATE "${def.table}" SET status = ?, updated_at = ?, archived_at = ? WHERE id = ?`)
        .run(status, now(), status === 'archived' ? now() : null, id);
      const after = this.get(entity, id);
      log(entity, id, action, before, after, opts);
      return after;
    });
  }

  archive(entity, id, opts = {}) {
    return this.#setStatus(entity, id, 'archived', 'archive', opts);
  }

  unarchive(entity, id, opts = {}) {
    return this.#setStatus(entity, id, 'published', 'unarchive', opts);
  }

  /** Hard delete is gated on archiving first, and the audit trail keeps the row. */
  remove(entity, id, opts = {}) {
    const def = requireEntity(entity);
    const before = this.get(entity, id);
    if (before.status !== 'archived') throw httpError(409, 'Archive an item before deleting it');
    return this.#commit([def.table], (log) => {
      this.db.prepare(`DELETE FROM "${def.table}" WHERE id = ?`).run(id);
      log(entity, id, 'delete', before, null, opts);
      return { id, deleted: true };
    });
  }

  revisions({ entity, id, limit = 100 } = {}) {
    const where = [];
    const params = [];
    if (entity) {
      where.push('entity = ?');
      params.push(entity);
    }
    if (id) {
      where.push('entity_id = ?');
      params.push(id);
    }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    return this.db
      .prepare(`SELECT id, entity, entity_id, action, author, note, created_at, before IS NOT NULL AS has_before, before, after
                FROM revisions ${clause} ORDER BY created_at DESC, id DESC LIMIT ?`)
      .all(...params, Number(limit))
      .map((r) => ({ ...r, has_before: Boolean(r.has_before), before: r.before ? JSON.parse(r.before) : null, after: r.after ? JSON.parse(r.after) : null }));
  }

  /** Rolls one item back to its state before the given revision, as a new revision. */
  rollback(revisionId, opts = {}) {
    const rev = this.db.prepare('SELECT * FROM revisions WHERE id = ?').get(revisionId);
    if (!rev) throw httpError(404, 'Unknown revision');
    if (rev.entity === 'settings') {
      if (!rev.before) throw httpError(409, 'This revision has no earlier value');
      return this.setSetting(rev.entity_id, JSON.parse(rev.before).value, { ...opts, note: `Rollback to before ${revisionId}` });
    }
    const def = requireEntity(rev.entity);
    if (!rev.before) throw httpError(409, 'This revision created the item, so there is no earlier state');
    const snapshot = JSON.parse(rev.before);
    const exists = this.#exists(def.table, rev.entity_id);
    const note = `Rollback to before ${revisionId}`;
    if (!exists) return this.create(rev.entity, { ...snapshot, id: rev.entity_id }, { ...opts, note });
    return this.update(rev.entity, rev.entity_id, snapshot, { ...opts, note });
  }

  settings() {
    const out = {};
    for (const row of this.db.prepare('SELECT id, value FROM settings ORDER BY id').all()) out[row.id] = JSON.parse(row.value);
    return out;
  }

  setSetting(key, value, opts = {}) {
    if (!/^[a-z0-9_.-]{1,64}$/.test(key)) throw httpError(400, 'Invalid setting key');
    if (value === undefined) throw httpError(400, 'Missing value');
    const prior = this.db.prepare('SELECT value FROM settings WHERE id = ?').get(key);
    return this.#commit(['settings'], (log) => {
      this.db
        .prepare('INSERT INTO settings (id, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at')
        .run(key, JSON.stringify(value), now());
      log('settings', key, prior ? 'update' : 'create', prior ? { value: JSON.parse(prior.value) } : null, { value }, opts);
      return { key, value };
    });
  }

  listMedia({ q, status = 'published', limit = 2000 } = {}) {
    const where = [];
    const params = [];
    if (status !== 'all') {
      where.push('status = ?');
      params.push(status);
    }
    if (q) {
      where.push('(filename LIKE ? OR alt_en LIKE ? OR alt_zh LIKE ?)');
      params.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    return this.db.prepare(`SELECT * FROM media ${clause} ORDER BY created_at DESC, id LIMIT ?`).all(...params, Number(limit));
  }

  getMedia(id) {
    const row = this.db.prepare('SELECT * FROM media WHERE id = ?').get(id);
    if (!row) throw httpError(404, 'Unknown media item');
    return row;
  }

  addMedia(buffer, { filename = 'upload', alt_en = '', alt_zh = '' } = {}, opts = {}) {
    const stored = storeFile(this.cfg, buffer);
    const existing = this.db.prepare('SELECT * FROM media WHERE id = ?').get(stored.id);
    if (existing) return existing;
    const safeName = path.basename(String(filename)).slice(0, 200) || 'upload';
    const stamp = now();
    const row = { ...stored, filename: safeName, alt_en, alt_zh, status: 'published', created_at: stamp, updated_at: stamp, archived_at: null };
    const keys = Object.keys(row);
    return this.#commit(['media'], (log) => {
      this.db
        .prepare(`INSERT INTO media (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`)
        .run(...keys.map((k) => row[k]));
      log('media', row.id, 'create', null, row, opts);
      return row;
    });
  }

  updateMedia(id, { alt_en, alt_zh, filename, status }, opts = {}) {
    const before = this.getMedia(id);
    if (status && !STATUSES.includes(status)) throw httpError(400, 'Unknown status');
    const next = {
      alt_en: alt_en ?? before.alt_en,
      alt_zh: alt_zh ?? before.alt_zh,
      filename: filename ?? before.filename,
      status: status ?? before.status,
    };
    return this.#commit(['media'], (log) => {
      this.db
        .prepare('UPDATE media SET alt_en = ?, alt_zh = ?, filename = ?, status = ?, updated_at = ?, archived_at = ? WHERE id = ?')
        .run(next.alt_en, next.alt_zh, next.filename, next.status, now(), next.status === 'archived' ? now() : null, id);
      const after = this.getMedia(id);
      log('media', id, 'update', before, after, opts);
      return after;
    });
  }

  /** Replaces all content from a snapshot; used by release restore. */
  replaceAll(tables, { note }) {
    const { db, cfg } = this;
    this.tx(() => {
      replaceContent(db, tables);
      const row = this.#log('site', 'all', 'release-restore', null, null, { note });
      fs.appendFileSync(cfg.revisionsFile, `${JSON.stringify(row)}\n`);
    });
    dumpAll(db, cfg);
    this.#setMeta('content_hash', contentHash(cfg.contentDir));
  }

  contentHash() {
    return contentHash(this.cfg.contentDir);
  }

  recordRelease(row) {
    this.db
      .prepare(`INSERT INTO releases (id, created_at, note, content_hash, counts, file, bytes, sha256) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(row.id, row.created_at, row.note, row.content_hash, JSON.stringify(row.counts), row.file, row.bytes, row.sha256);
  }

  releases() {
    return this.db
      .prepare('SELECT * FROM releases ORDER BY created_at DESC, id DESC')
      .all()
      .map((r) => ({ ...r, counts: JSON.parse(r.counts) }));
  }

  status() {
    const counts = {};
    for (const [key, def] of Object.entries(ENTITIES)) {
      const rows = this.db.prepare(`SELECT status, COUNT(*) AS n FROM "${def.table}" GROUP BY status`).all();
      counts[key] = Object.fromEntries(rows.map((r) => [r.status, r.n]));
    }
    const media = this.db.prepare('SELECT COUNT(*) AS n, COALESCE(SUM(bytes), 0) AS bytes FROM media').get();
    return {
      dbPath: this.cfg.dbPath,
      contentHash: this.contentHash(),
      counts,
      media,
      revisions: this.db.prepare('SELECT COUNT(*) AS n FROM revisions').get().n,
      releases: this.db.prepare('SELECT COUNT(*) AS n FROM releases').get().n,
      latestRelease: this.db.prepare('SELECT id, created_at, content_hash FROM releases ORDER BY created_at DESC, id DESC LIMIT 1').get() ?? null,
    };
  }
}
