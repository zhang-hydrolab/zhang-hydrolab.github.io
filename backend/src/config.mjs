import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const BACKEND_ROOT = path.resolve(here, '..');
export const API_SCHEMA_VERSION = 1;

/**
 * Resolves runtime paths. `LAB_BACKEND_ROOT` redirects all mutable state, which
 * is how the test suite runs against a throwaway copy.
 */
export function loadConfig(env = process.env) {
  const root = env.LAB_BACKEND_ROOT ? path.resolve(env.LAB_BACKEND_ROOT) : BACKEND_ROOT;
  const archiveDir = path.join(root, 'archive');
  return {
    root,
    host: env.LAB_HOST || '127.0.0.1',
    port: Number(env.LAB_PORT || 8787),
    adminToken: env.LAB_ADMIN_TOKEN || '',
    dbPath: env.LAB_DB_PATH ? path.resolve(env.LAB_DB_PATH) : path.join(root, 'var', 'lab.sqlite'),
    contentDir: path.join(root, 'content'),
    archiveDir,
    mediaDir: path.join(archiveDir, 'media'),
    releasesDir: path.join(archiveDir, 'releases'),
    revisionsFile: path.join(archiveDir, 'revisions.ndjson'),
    migrationsDir: path.join(BACKEND_ROOT, 'migrations'),
    adminDir: path.join(BACKEND_ROOT, 'admin'),
    projectRoot: path.resolve(BACKEND_ROOT, '..'),
  };
}
