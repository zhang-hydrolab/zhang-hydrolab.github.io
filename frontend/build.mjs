import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import esbuild from 'esbuild';
import { loadApi } from './src/lib/api.mjs';
import { buildMedia } from './src/lib/media.mjs';
import { homePage } from './src/views/home.mjs';
import { articlePage, collaborationPage, dataPage, newsPage, notFoundPage, peoplePage, publicationsPage, researchPage } from './src/views/pages.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));

export async function bundle(outDir, { dev = false } = {}) {
  const assetsDir = path.join(outDir, 'assets');
  const result = await esbuild.build({
    absWorkingDir: ROOT,
    entryPoints: { main: 'src/client/main.js', style: 'src/styles/main.css' },
    bundle: true,
    splitting: true,
    format: 'esm',
    minify: !dev,
    sourcemap: dev,
    target: ['es2022', 'chrome111', 'safari16.4', 'firefox120'],
    outdir: assetsDir,
    entryNames: dev ? '[name]' : '[name]-[hash]',
    chunkNames: 'chunks/[name]-[hash]',
    assetNames: 'fonts/[name]-[hash]',
    loader: { '.woff2': 'file' },
    metafile: true,
    logLevel: 'warning',
  });

  const assets = { fonts: [] };
  for (const output of Object.keys(result.metafile.outputs)) {
    const href = `/${path.relative(outDir, path.resolve(ROOT, output)).replaceAll('\\', '/')}`;
    if (output.endsWith('.map')) continue;
    if (/assets\/main[-.]/.test(output) && output.endsWith('.js')) assets.js = href;
    if (/assets\/style[-.]/.test(output) && output.endsWith('.css')) assets.css = href;
    if (/source-(sans-3|serif-4)-latin-wght-normal/.test(output)) assets.fonts.push(href);
  }
  return assets;
}

function buildSearchIndex(api) {
  const items = [];
  for (const group of api.people.groups) {
    for (const p of group.members) {
      items.push({ type: 'Person', title: p.name_en, sub: [p.name_zh, group.label.en].filter(Boolean).join(' · '), url: group.key === 'pi' ? '/people.html#pi' : `/people.html#p-${p.id}`, text: `${p.name_en} ${p.name_zh} ${p.research_field}`.toLowerCase() });
    }
  }
  for (const p of api.publications.items) {
    items.push({ type: 'Paper', title: p.title, sub: `${p.venue} ${p.year}`, url: p.doi ? `https://doi.org/${p.doi}` : (p.url || '/publications.html'), text: `${p.title} ${p.authors} ${p.venue} ${p.year}`.toLowerCase() });
  }
  for (const d of api.datasets.items) {
    items.push({ type: 'Dataset', title: d.name, sub: d.coverage_label, url: `/data.html#${d.id}`, text: `${d.name} ${d.summary_en} ${d.variables}`.toLowerCase() });
  }
  for (const n of api.news.items) {
    items.push({ type: 'News', title: n.title_en || n.title_zh, sub: String(n.year), url: n.body_md ? `/news/${encodeURIComponent(n.id)}.html` : (n.source_url || '/news.html'), text: `${n.title_en} ${n.title_zh}`.toLowerCase() });
  }
  for (const theme of api.research.themes) {
    items.push({ type: 'Research', title: theme.title_en, sub: theme.title_zh, url: `/research.html#${theme.id}`, text: `${theme.title_en} ${theme.title_zh} ${theme.summary_en}`.toLowerCase() });
    for (const p of theme.projects) items.push({ type: 'Research', title: p.name, sub: theme.title_en, url: `/research.html#${theme.id}`, text: `${p.name} ${p.description}`.toLowerCase() });
  }
  for (const c of api.collaborators.items) {
    items.push({ type: 'Collaborator', title: c.name, sub: c.institute, url: `/collaboration.html#${c.id}`, text: `${c.name} ${c.institute}`.toLowerCase() });
  }
  return items;
}

export async function buildSite({ apiSource, mediaSource, outDir, dev = false }) {
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  const api = await loadApi(apiSource);
  const { images, files, generated } = await buildMedia(api, { mediaSource, outDir, cacheDir: path.join(ROOT, '.cache', 'media') });
  const assets = await bundle(outDir, { dev });
  const ctx = { api, images, files, assets, mediaById: new Map(api.media.items.map((m) => [m.id, m])) };

  const pages = {
    'index.html': homePage(ctx),
    'research.html': researchPage(ctx),
    'publications.html': publicationsPage(ctx),
    'data.html': dataPage(ctx),
    'people.html': peoplePage(ctx),
    'news.html': newsPage(ctx),
    'collaboration.html': collaborationPage(ctx),
    '404.html': notFoundPage(ctx),
  };
  for (const n of api.news.items) if (n.body_md) pages[`news/${n.id}.html`] = articlePage(ctx, n);

  for (const [file, content] of Object.entries(pages)) {
    const target = path.join(outDir, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  }

  const copyDir = path.join(ROOT, 'src', 'public');
  fs.copyFileSync(path.join(copyDir, 'favicon.svg'), path.join(outDir, 'favicon.svg'));
  fs.cpSync(path.join(copyDir, 'earth'), path.join(outDir, 'earth'), { recursive: true });
  fs.writeFileSync(path.join(outDir, '.nojekyll'), '');
  fs.writeFileSync(path.join(outDir, 'assets', 'search-index.json'), JSON.stringify(buildSearchIndex(api)));

  // The public API travels with the site, so other tools can read it too.
  const apiOut = path.join(outDir, 'api', 'v1');
  fs.mkdirSync(apiOut, { recursive: true });
  for (const [name, body] of Object.entries(api)) fs.writeFileSync(path.join(apiOut, `${name}.json`), `${JSON.stringify(body, null, 2)}\n`);

  const base = api.site['site.lab'].url.replace(/\/$/, '');
  const urls = Object.keys(pages).filter((p) => p !== '404.html').map((p) => (p === 'index.html' ? `${base}/` : `${base}/${encodeURI(p)}`));
  fs.writeFileSync(path.join(outDir, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `<url><loc>${u}</loc></url>`).join('\n')}\n</urlset>\n`);
  fs.writeFileSync(path.join(outDir, 'robots.txt'), `User-agent: *\nDisallow: /backend/\nDisallow: /frontend/\nSitemap: ${base}/sitemap.xml\n`);

  return { pages: Object.keys(pages).length, images: Object.keys(images).length, generated };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { values } = parseArgs({ options: { api: { type: 'string' }, media: { type: 'string' }, out: { type: 'string' }, dev: { type: 'boolean' } } });
  const started = Date.now();
  const summary = await buildSite({
    apiSource: values.api ?? process.env.LAB_API_SOURCE ?? path.resolve(ROOT, '..', 'api', 'v1'),
    mediaSource: values.media ?? process.env.LAB_MEDIA_SOURCE ?? path.resolve(ROOT, '..', 'backend', 'archive', 'media'),
    outDir: path.resolve(ROOT, values.out ?? 'dist'),
    dev: values.dev,
  });
  console.log(`Built ${summary.pages} pages, ${summary.images} images (${summary.generated} new variants) in ${((Date.now() - started) / 1000).toFixed(1)}s`);
}
