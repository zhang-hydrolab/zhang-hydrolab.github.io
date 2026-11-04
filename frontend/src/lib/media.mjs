import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const WIDTHS = {
  portrait: [240, 480, 800],
  card: [480, 960, 1440],
  figure: [640, 1280, 1920],
  full: [800, 1600, 2400],
  mark: [160, 320],
};
const PIPELINE_VERSION = 2;
const QUALITY = { mark: 90, figure: 90, card: 88, portrait: 84, full: 84 };

/** Decides which published files the site needs, and at what sizes. */
function collectUsage(api) {
  const usage = new Map();
  const use = (id, kind) => {
    if (id && !usage.has(id)) usage.set(id, kind);
  };

  for (const group of api.people.groups) for (const p of group.members) use(p.photo_id, 'portrait');
  for (const c of api.collaborators.items) {
    use(c.photo_id, 'portrait');
    for (const id of c.gallery ?? []) use(id, 'card');
  }
  for (const n of api.news.items) {
    use(n.cover_id, 'card');
    for (const match of n.body_md.matchAll(/\(media:([0-9a-f]{16})\)/g)) use(match[1], 'figure');
  }
  for (const d of api.datasets.items) use(d.image_id, 'figure');
  for (const theme of api.research.themes) {
    use(theme.image_id, 'mark');
    for (const p of theme.projects) use(p.image_id, 'figure');
  }
  for (const p of api.publications.items) use(p.pdf_id, 'file');

  const assets = api.site['site.assets'] ?? {};
  use(assets.logo, 'mark');
  use(assets.cover, 'full');
  use(assets.group_photo, 'full');
  use(assets.group_photo_alt, 'full');
  for (const f of api.site['site.featured_research'] ?? []) use(f.image_id, 'figure');
  return usage;
}

async function readOriginal(mediaSource, item) {
  const name = `${item.sha256}.${item.ext}`;
  if (/^https?:\/\//.test(mediaSource)) {
    const response = await fetch(`${mediaSource.replace(/\/$/, '')}/${name}`);
    if (!response.ok) throw new Error(`Media ${name} returned ${response.status}`);
    return Buffer.from(await response.arrayBuffer());
  }
  return fs.readFileSync(path.join(mediaSource, item.sha256.slice(0, 2), name));
}

const toHex = ({ r, g, b }) => `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;

/**
 * Generates responsive WebP variants into `outDir/media`. Results are cached by
 * content hash, so only new images cost anything on the next publish.
 */
export async function buildMedia(api, { mediaSource, outDir, cacheDir }) {
  const usage = collectUsage(api);
  const byId = new Map(api.media.items.map((m) => [m.id, m]));
  const mediaOut = path.join(outDir, 'media');
  fs.mkdirSync(mediaOut, { recursive: true });
  fs.mkdirSync(cacheDir, { recursive: true });

  const images = {};
  const files = {};
  let generated = 0;

  for (const [id, kind] of usage) {
    const item = byId.get(id);
    if (!item) throw new Error(`Content references media ${id}, which is not published`);

    if (kind === 'file') {
      const name = `${id}.${item.ext}`;
      const cached = path.join(cacheDir, name);
      if (!fs.existsSync(cached)) fs.writeFileSync(cached, await readOriginal(mediaSource, item));
      fs.copyFileSync(cached, path.join(mediaOut, name));
      files[id] = { src: `/media/${name}`, bytes: item.bytes };
      continue;
    }

    const key = crypto.createHash('sha1').update(`${PIPELINE_VERSION}:${item.sha256}:${kind}`).digest('hex').slice(0, 16);
    const indexFile = path.join(cacheDir, `${key}.json`);
    let record = fs.existsSync(indexFile) ? JSON.parse(fs.readFileSync(indexFile, 'utf8')) : null;
    if (record && !record.variants.every((v) => fs.existsSync(path.join(cacheDir, v.file)))) record = null;

    if (!record) {
      const input = await readOriginal(mediaSource, item);
      const base = sharp(input, { limitInputPixels: false }).rotate();
      const meta = await base.clone().metadata();
      const stats = await base.clone().flatten({ background: '#ffffff' }).stats();
      const upright = (meta.orientation ?? 1) >= 5;
      const width = upright ? meta.height : meta.width;
      const height = upright ? meta.width : meta.height;
      const targets = [...new Set(WIDTHS[kind].map((w) => Math.min(w, width)))];
      const variants = [];
      for (const w of targets) {
        const file = `${id}-${w}.webp`;
        await base.clone().resize({ width: w, withoutEnlargement: true }).webp({ quality: QUALITY[kind], smartSubsample: true, effort: 5 }).toFile(path.join(cacheDir, file));
        variants.push({ w, file });
        generated += 1;
      }
      record = { width, height, color: toHex(stats.dominant), variants };
      fs.writeFileSync(indexFile, JSON.stringify(record));
    }

    for (const v of record.variants) fs.copyFileSync(path.join(cacheDir, v.file), path.join(mediaOut, v.file));
    const last = record.variants.at(-1);
    images[id] = {
      width: record.width,
      height: record.height,
      color: record.color,
      src: `/media/${last.file}`,
      srcset: record.variants.map((v) => `/media/${v.file} ${v.w}w`).join(', '),
      thumb: `/media/${record.variants[0].file}`,
    };
  }

  return { images, files, generated };
}
