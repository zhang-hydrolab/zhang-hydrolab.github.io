import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { readContentFiles, writeFileAtomic } from './dump.mjs';

const httpError = (status, message) => Object.assign(new Error(message), { status });
const SAFE_ID = /^[0-9TZ]+-[0-9a-f]{8}$/;

function readRelease(cfg, row) {
  const file = path.join(cfg.releasesDir, row.file);
  const gz = fs.readFileSync(file);
  const sha256 = crypto.createHash('sha256').update(gz).digest('hex');
  if (sha256 !== row.sha256) throw httpError(500, `Release ${row.id} failed its checksum`);
  return JSON.parse(zlib.gunzipSync(gz).toString('utf8'));
}

/**
 * Freezes the current content as an immutable, checksummed snapshot. Skipped
 * when nothing changed since the latest release.
 */
export function createRelease(store, { note = '', force = false } = {}) {
  const { cfg } = store;
  const contentHash = store.contentHash();
  const latest = store.releases()[0];
  if (latest && latest.content_hash === contentHash && !force) return { ...latest, skipped: true };

  const created_at = new Date().toISOString();
  const id = `${created_at.replace(/[-:.]/g, '').slice(0, 15)}Z-${contentHash.slice(0, 8)}`;
  const tables = readContentFiles(cfg);
  const body = JSON.stringify({ format: 1, id, created_at, note, contentHash, tables });
  const gz = zlib.gzipSync(body, { level: 9 });
  const file = `${id}.json.gz`;
  writeFileAtomic(path.join(cfg.releasesDir, file), gz);

  const row = {
    id,
    created_at,
    note,
    content_hash: contentHash,
    counts: Object.fromEntries(Object.entries(tables).map(([t, rows]) => [t, rows.length])),
    file,
    bytes: gz.length,
    sha256: crypto.createHash('sha256').update(gz).digest('hex'),
  };
  fs.appendFileSync(path.join(cfg.releasesDir, 'index.ndjson'), `${JSON.stringify(row)}\n`);
  store.recordRelease(row);
  return row;
}

/** Restores a release after first snapshotting the current state, so a restore can be undone. */
export function restoreRelease(store, id) {
  if (!SAFE_ID.test(id)) throw httpError(400, 'Invalid release id');
  const row = store.releases().find((r) => r.id === id);
  if (!row) throw httpError(404, 'Unknown release');
  const snapshot = readRelease(store.cfg, row);
  const safety = createRelease(store, { note: `Automatic snapshot before restoring ${id}`, force: false });
  store.replaceAll(snapshot.tables, { note: `Restored release ${id}` });
  return { restored: id, safetySnapshot: safety.id };
}

export function verifyReleases(store) {
  return store.releases().map((row) => {
    try {
      readRelease(store.cfg, row);
      return { id: row.id, ok: true };
    } catch (err) {
      return { id: row.id, ok: false, error: err.message };
    }
  });
}
