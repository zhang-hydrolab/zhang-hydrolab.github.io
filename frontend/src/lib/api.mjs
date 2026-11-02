import fs from 'node:fs';
import path from 'node:path';

export const SUPPORTED_SCHEMA = 1;
const FILES = ['meta', 'site', 'people', 'publications', 'news', 'datasets', 'research', 'collaborators', 'media'];

/**
 * The only way this project reads content. `source` is a directory holding the
 * published JSON, or the base URL of a running backend. The frontend never
 * touches the database, so either source yields the same site.
 */
export async function loadApi(source) {
  const remote = /^https?:\/\//.test(source);
  const read = async (name) => {
    if (remote) {
      const response = await fetch(`${source.replace(/\/$/, '')}/${name}.json`);
      if (!response.ok) throw new Error(`API ${name}.json returned ${response.status}`);
      return response.json();
    }
    const file = path.join(source, `${name}.json`);
    if (!fs.existsSync(file)) throw new Error(`Missing ${file}. Run "npm run publish" from the repository root, or pass --api.`);
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  };

  const entries = await Promise.all(FILES.map(async (name) => [name, await read(name)]));
  const api = Object.fromEntries(entries);
  if (api.meta.schemaVersion !== SUPPORTED_SCHEMA) {
    throw new Error(`API schema ${api.meta.schemaVersion} is not supported (frontend expects ${SUPPORTED_SCHEMA}).`);
  }
  return api;
}
