import path from 'node:path';
import { parseArgs } from 'node:util';
import { loadConfig } from './config.mjs';
import { writeApi } from './export.mjs';
import { createRelease, restoreRelease, verifyReleases } from './releases.mjs';
import { Store } from './store.mjs';

const USAGE = `Usage: node src/cli.mjs <command>

  db:status                   Show row counts, content hash and latest release
  db:rebuild                  Rebuild the SQLite file from content/*.ndjson
  export --out <dir>          Write the public API JSON files
  release:list                List archived releases
  release:create [--note t]   Snapshot current content into archive/releases
  release:restore <id>        Restore a snapshot (saves current state first)
  release:verify              Check every archived release against its checksum`;

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { out: { type: 'string' }, note: { type: 'string' } },
});
const [command, arg] = positionals;

const cfg = loadConfig();
const store = Store.open(cfg);

try {
  switch (command) {
    case 'db:status':
      console.log(JSON.stringify(store.status(), null, 2));
      break;
    case 'db:rebuild':
      store.rebuildFromContent();
      console.log(`Rebuilt ${cfg.dbPath}`);
      break;
    case 'export': {
      if (!values.out) throw new Error('export needs --out <dir>');
      const out = path.resolve(values.out);
      console.log(`Exported ${writeApi(store, out).length} API files to ${out}`);
      break;
    }
    case 'release:list':
      for (const r of store.releases()) console.log(`${r.id}  ${r.note}`);
      break;
    case 'release:create': {
      const row = createRelease(store, { note: values.note ?? '' });
      console.log(row.skipped ? `No content change since ${row.id}; no new release.` : `Created release ${row.id}`);
      break;
    }
    case 'release:restore':
      if (!arg) throw new Error('release:restore needs a release id');
      console.log(JSON.stringify(restoreRelease(store, arg), null, 2));
      break;
    case 'release:verify': {
      const results = verifyReleases(store);
      for (const r of results) console.log(`${r.ok ? 'ok  ' : 'FAIL'} ${r.id} ${r.error ?? ''}`);
      if (results.some((r) => !r.ok)) process.exitCode = 1;
      break;
    }
    default:
      console.log(USAGE);
      if (command) process.exitCode = 1;
  }
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
} finally {
  store.close();
}
