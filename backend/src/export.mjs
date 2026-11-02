import fs from 'node:fs';
import path from 'node:path';
import { API_SCHEMA_VERSION } from './config.mjs';
import { ROLES } from './entities.mjs';

const ROLE_LABELS = {
  pi: { en: 'Principal Investigator', zh: '团队负责人' },
  co_pi: { en: 'Co-PI', zh: '科研人员' },
  postdoc: { en: 'Postdoc', zh: '博士后' },
  phd: { en: 'Ph.D. Students', zh: '博士研究生' },
  master: { en: 'Master Students', zh: '硕士研究生' },
  assistant: { en: 'Research Assistants', zh: '科研助理' },
  visiting: { en: 'Visiting Students', zh: '访问学生' },
  alumni: { en: 'Alumni', zh: '校友' },
};

/** Strips bookkeeping columns: the public contract is content only. */
function publicRow(row) {
  const { _title, _subtitle, status, created_at, updated_at, archived_at, sort_order, ...rest } = row;
  return rest;
}

const published = (store, entity) => store.list(entity, { status: 'published', limit: 100000 });
const stamp = (rows) => rows.reduce((max, r) => (r.updated_at > max ? r.updated_at : max), '');

/**
 * Builds the versioned public API. Output is deterministic for given content,
 * so a publish with no content change produces no diff.
 */
export function buildApi(store) {
  const peopleRows = published(store, 'people');
  const groups = ROLES.map((key) => ({
    key,
    label: ROLE_LABELS[key],
    members: peopleRows.filter((p) => p.role === key).map(publicRow),
  })).filter((g) => g.members.length);

  const pubRows = published(store, 'publications');
  const yearCounts = new Map();
  const topicCounts = new Map();
  for (const p of pubRows) {
    yearCounts.set(p.year, (yearCounts.get(p.year) ?? 0) + 1);
    for (const t of p.topics) topicCounts.set(t, (topicCounts.get(t) ?? 0) + 1);
  }

  const newsRows = published(store, 'news');
  const datasetRows = published(store, 'datasets');
  const themeRows = published(store, 'research_themes');
  const projectRows = published(store, 'research_projects');
  const collabRows = published(store, 'collaborators');
  const mediaRows = store.listMedia({ status: 'published', limit: 100000 });
  const settings = store.settings();

  const all = [peopleRows, pubRows, newsRows, datasetRows, themeRows, projectRows, collabRows];
  const updatedAt = all.map(stamp).reduce((max, s) => (s > max ? s : max), '');

  return {
    'meta.json': {
      schemaVersion: API_SCHEMA_VERSION,
      contentHash: store.contentHash(),
      updatedAt,
      counts: {
        people: peopleRows.filter((p) => p.role !== 'alumni').length,
        alumni: peopleRows.filter((p) => p.role === 'alumni').length,
        publications: pubRows.length,
        news: newsRows.length,
        datasets: datasetRows.length,
        researchThemes: themeRows.length,
        researchProjects: projectRows.length,
        collaborators: collabRows.length,
      },
    },
    'site.json': settings,
    'people.json': { count: peopleRows.length, groups },
    'publications.json': {
      count: pubRows.length,
      years: [...yearCounts].sort((a, b) => a[0] - b[0]).map(([year, count]) => ({ year, count })),
      topics: [...topicCounts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([topic, count]) => ({ topic, count })),
      items: pubRows.map(publicRow),
    },
    'news.json': { count: newsRows.length, items: newsRows.map(publicRow) },
    'datasets.json': { count: datasetRows.length, items: datasetRows.map(publicRow) },
    'research.json': {
      themes: themeRows.map((theme) => ({
        ...publicRow(theme),
        projects: projectRows.filter((p) => p.theme_id === theme.id).map(publicRow),
      })),
    },
    'collaborators.json': { count: collabRows.length, items: collabRows.map(publicRow) },
    'media.json': {
      count: mediaRows.length,
      items: mediaRows.map(({ id, sha256, ext, mime, bytes, filename, alt_en, alt_zh }) => ({ id, sha256, ext, mime, bytes, filename, alt_en, alt_zh })),
    },
  };
}

export function writeApi(store, outDir) {
  const api = buildApi(store);
  fs.mkdirSync(outDir, { recursive: true });
  for (const [name, body] of Object.entries(api)) {
    fs.writeFileSync(path.join(outDir, name), `${JSON.stringify(body, null, 2)}\n`);
  }
  return Object.keys(api);
}
