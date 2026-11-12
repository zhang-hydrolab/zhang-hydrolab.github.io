import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

/**
 * The SQLite file is the working database; it is rebuildable and not committed.
 * Durable, reviewable, merge-friendly state lives in `content/<table>.ndjson`:
 * one JSON row per line, sorted by primary key.
 */
export const CONTENT_TABLES = [
  'media',
  'people',
  'publications',
  'news',
  'datasets',
  'models',
  'research_themes',
  'research_projects',
  'collaborators',
  'settings',
];

export function writeFileAtomic(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, data);
  fs.renameSync(tmp, file);
}

export const tableRows = (db, table) => db.prepare(`SELECT * FROM "${table}" ORDER BY id`).all();

export function serializeRows(rows) {
  return rows.length ? `${rows.map((row) => JSON.stringify(row)).join('\n')}\n` : '';
}

export function parseRows(text) {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

export function dumpTable(db, cfg, table) {
  writeFileAtomic(path.join(cfg.contentDir, `${table}.ndjson`), serializeRows(tableRows(db, table)));
}

export function dumpAll(db, cfg) {
  for (const table of CONTENT_TABLES) dumpTable(db, cfg, table);
}

export function contentHash(contentDir) {
  const hash = crypto.createHash('sha256');
  for (const table of CONTENT_TABLES) {
    const file = path.join(contentDir, `${table}.ndjson`);
    hash.update(`${table}\0`);
    // Normalised so a CRLF checkout hashes the same as the committed LF file.
    if (fs.existsSync(file)) hash.update(fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n'));
    hash.update('\0');
  }
  return hash.digest('hex');
}

export function insertRows(db, table, rows) {
  if (!rows.length) return;
  const columns = new Set(db.prepare(`PRAGMA table_info("${table}")`).all().map((c) => c.name));
  for (const row of rows) {
    const keys = Object.keys(row).filter((k) => columns.has(k));
    const sql = `INSERT INTO "${table}" (${keys.map((k) => `"${k}"`).join(',')}) VALUES (${keys.map(() => '?').join(',')})`;
    db.prepare(sql).run(...keys.map((k) => row[k]));
  }
}

/** Replaces every content table with `tablesByName`, inside the caller's transaction. */
export function replaceContent(db, tablesByName) {
  db.exec('PRAGMA defer_foreign_keys = ON');
  for (const table of [...CONTENT_TABLES].reverse()) db.exec(`DELETE FROM "${table}"`);
  for (const table of CONTENT_TABLES) insertRows(db, table, tablesByName[table] ?? []);
}

export function readContentFiles(cfg) {
  const tables = {};
  for (const table of CONTENT_TABLES) {
    const file = path.join(cfg.contentDir, `${table}.ndjson`);
    tables[table] = fs.existsSync(file) ? parseRows(fs.readFileSync(file, 'utf8')) : [];
  }
  return tables;
}
