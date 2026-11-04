/**
 * Declarative definition of every editable content type. The store, the
 * validator and the admin forms are all driven from this one table, so adding a
 * field means: a migration, plus one line here.
 */

const text = (name, label, extra = {}) => ({ name, label, type: 'text', ...extra });
const long = (name, label, extra = {}) => ({ name, label, type: 'longtext', ...extra });

const sortOrder = { name: 'sort_order', label: 'Sort order (lower first)', type: 'int', default: 100 };

export const ROLES = ['pi', 'co_pi', 'postdoc', 'phd', 'master', 'assistant', 'visiting', 'alumni'];

export const ENTITIES = {
  news: {
    table: 'news',
    label: 'News',
    title: (r) => r.title_en || r.title_zh,
    subtitle: (r) => `${r.year} · ${r.category}`,
    order: 'year DESC, date DESC, sort_order ASC, id DESC',
    slugFrom: (r) => `${r.year}-${r.title_en || r.title_zh}`,
    search: ['title_en', 'title_zh', 'summary_en', 'summary_zh'],
    fields: [
      { name: 'year', label: 'Year', type: 'int', required: true, min: 1990, max: 2100 },
      { name: 'date', label: 'Date (YYYY-MM-DD, optional)', type: 'date' },
      { name: 'category', label: 'Category', type: 'enum', options: ['news', 'publication', 'award', 'event'], default: 'news' },
      text('title_en', 'Title (English)'),
      text('title_zh', 'Title (中文)'),
      long('summary_en', 'Summary (English)'),
      long('summary_zh', 'Summary (中文)'),
      { name: 'body_md', label: 'Article body (Markdown). Filled = gets its own page', type: 'markdown' },
      { name: 'source_url', label: 'Source link', type: 'url' },
      { name: 'cover_id', label: 'Cover image', type: 'media', accept: 'image' },
      { name: 'featured', label: 'Feature on homepage', type: 'bool', default: 0 },
      sortOrder,
    ],
    check: (r) => (r.title_en || r.title_zh ? null : { title_en: 'Provide a title in at least one language' }),
  },

  publications: {
    table: 'publications',
    label: 'Publications',
    title: (r) => r.title,
    subtitle: (r) => `${r.year} · ${r.venue}`,
    order: 'year DESC, sort_order ASC, id ASC',
    slugFrom: (r) => `${r.year}-${r.authors.split(',')[0]}-${r.title.split(/\s+/).slice(0, 5).join('-')}`,
    search: ['title', 'authors', 'venue', 'doi'],
    fields: [
      { name: 'year', label: 'Year', type: 'int', required: true, min: 1990, max: 2100 },
      text('title', 'Title', { required: true }),
      long('authors', 'Authors', { required: true, help: 'APA style: Zhang, Y., Ma, N., & Tian, J.' }),
      text('venue', 'Journal / venue'),
      text('volume', 'Volume'),
      text('issue', 'Issue'),
      text('pages', 'Pages / article number'),
      text('doi', 'DOI', { help: 'Bare DOI, e.g. 10.1038/s41561-025-01897-9' }),
      { name: 'url', label: 'Link (only if there is no DOI)', type: 'url' },
      { name: 'pdf_id', label: 'PDF', type: 'media', accept: 'pdf' },
      { name: 'topics', label: 'Topics', type: 'strings' },
      { name: 'featured', label: 'Highlighted paper', type: 'bool', default: 0 },
      sortOrder,
    ],
  },

  people: {
    table: 'people',
    label: 'People',
    title: (r) => r.name_en,
    subtitle: (r) => [r.name_zh, r.role].filter(Boolean).join(' · '),
    order: 'sort_order ASC, name_en ASC',
    slugFrom: (r) => r.name_en,
    search: ['name_en', 'name_zh', 'research_field', 'research_field_zh', 'email'],
    fields: [
      text('name_en', 'Name (English)', { required: true }),
      text('name_zh', 'Name (中文)'),
      { name: 'honorific', label: 'Honorific', type: 'enum', options: ['', 'Prof.', 'Dr.'], default: '' },
      { name: 'role', label: 'Role', type: 'enum', options: ROLES, required: true, help: 'Move graduates to "alumni" rather than archiving them' },
      text('research_field', 'Research field (English)'),
      text('research_field_zh', 'Research field (中文)'),
      long('bio_en', 'Bio (English)'),
      long('bio_zh', 'Bio (中文)'),
      { name: 'email', label: 'Email', type: 'email' },
      { name: 'links', label: 'Links', type: 'links' },
      { name: 'author_names', label: 'Other author-list spellings', type: 'strings', help: 'Only spellings that differ from the English name, e.g. Eshete, D. G.' },
      { name: 'photo_id', label: 'Photo', type: 'media', accept: 'image' },
      text('photo_focus', 'Photo focus (CSS position)', { default: '50% 25%' }),
      sortOrder,
    ],
  },

  datasets: {
    table: 'datasets',
    label: 'Datasets',
    title: (r) => r.name,
    subtitle: (r) => r.coverage_label,
    order: 'sort_order ASC, name ASC',
    slugFrom: (r) => r.name,
    search: ['name', 'summary_en', 'variables'],
    fields: [
      text('name', 'Name', { required: true }),
      long('summary_en', 'Summary (English)'),
      long('summary_zh', 'Summary (中文)'),
      text('scope', 'Spatial scope', { help: 'Global, China ...' }),
      text('variables', 'Variables'),
      text('temporal', 'Temporal resolution'),
      text('spatial', 'Spatial resolution'),
      { name: 'start_year', label: 'First year', type: 'int', min: 1900, max: 2100 },
      { name: 'end_year', label: 'Last year (empty = ongoing)', type: 'int', min: 1900, max: 2100 },
      text('coverage_label', 'Coverage label'),
      { name: 'downloads', label: 'Download links', type: 'links' },
      { name: 'citations', label: 'How to cite', type: 'strings', multiline: true },
      { name: 'image_id', label: 'Figure', type: 'media', accept: 'image' },
      sortOrder,
    ],
  },

  research_themes: {
    table: 'research_themes',
    label: 'Research themes',
    title: (r) => r.title_en,
    subtitle: (r) => r.title_zh,
    order: 'sort_order ASC, title_en ASC',
    slugFrom: (r) => r.title_en,
    search: ['title_en', 'title_zh', 'summary_en'],
    fields: [
      text('title_en', 'Title (English)', { required: true }),
      text('title_zh', 'Title (中文)'),
      text('heading_en', 'Long heading (English)'),
      long('summary_en', 'Summary (English)'),
      long('summary_zh', 'Summary (中文)'),
      { name: 'image_id', label: 'Illustration', type: 'media', accept: 'image' },
      { name: 'accent', label: 'Accent colour', type: 'enum', options: ['blue', 'lime', 'coral'], default: 'blue' },
      sortOrder,
    ],
  },

  research_projects: {
    table: 'research_projects',
    label: 'Research projects',
    title: (r) => r.name,
    subtitle: (r) => r.theme_id,
    order: 'theme_id ASC, sort_order ASC, name ASC',
    slugFrom: (r) => r.name,
    search: ['name', 'description'],
    fields: [
      { name: 'theme_id', label: 'Theme', type: 'ref', ref: 'research_themes', required: true },
      text('name', 'Name', { required: true }),
      text('name_zh', 'Name (中文)'),
      long('description', 'Description'),
      long('description_zh', 'Description (中文)'),
      { name: 'image_id', label: 'Figure', type: 'media', accept: 'image' },
      { name: 'related', label: 'Related publications', type: 'strings', multiline: true },
      sortOrder,
    ],
  },

  collaborators: {
    table: 'collaborators',
    label: 'Collaborators',
    title: (r) => r.name,
    subtitle: (r) => r.institute,
    order: 'sort_order ASC, name ASC',
    slugFrom: (r) => r.name,
    search: ['name', 'institute', 'institute_zh', 'bio', 'bio_zh'],
    fields: [
      text('name', 'Name', { required: true }),
      text('title_en', 'Position (English)'),
      text('title_zh', 'Position (中文)'),
      text('institute', 'Institute'),
      text('institute_zh', 'Institute (中文)'),
      text('city', 'City'),
      { name: 'lat', label: 'Latitude', type: 'real', min: -90, max: 90 },
      { name: 'lon', label: 'Longitude', type: 'real', min: -180, max: 180 },
      long('bio', 'Bio (English)'),
      long('bio_zh', 'Bio (中文)'),
      text('author_name', 'Name in author lists', { help: 'APA form used to find co-authored papers, e.g. Blöschl, G.' }),
      { name: 'links', label: 'Links', type: 'links' },
      { name: 'photo_id', label: 'Photo', type: 'media', accept: 'image' },
      { name: 'gallery', label: 'Photos with the group (media ids)', type: 'strings', help: 'One media id per line. The caption comes from the file description.' },
      sortOrder,
    ],
  },
};

export const STATUSES = ['draft', 'published', 'archived'];

export class ValidationError extends Error {
  constructor(fields) {
    super(`Validation failed: ${Object.entries(fields).map(([k, v]) => `${k} (${v})`).join(', ')}`);
    this.name = 'ValidationError';
    this.fields = fields;
    this.status = 400;
  }
}

const EMAIL = /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Links render straight into public pages, so only web and mail schemes pass. */
export function isSafeUrl(value) {
  if (typeof value !== 'string' || value.length > 2048) return false;
  try {
    const u = new URL(value);
    return ['http:', 'https:', 'mailto:'].includes(u.protocol);
  } catch {
    return false;
  }
}

export const isJsonField = (field) => ['links', 'strings'].includes(field.type);

function coerce(field, raw, errors) {
  const empty = raw === undefined || raw === null || raw === '';
  const fail = (msg) => {
    errors[field.name] = msg;
    return undefined;
  };

  switch (field.type) {
    case 'int':
    case 'real': {
      if (empty) return field.required ? fail('required') : (field.default ?? null);
      const n = Number(raw);
      if (!Number.isFinite(n) || (field.type === 'int' && !Number.isInteger(n))) return fail('must be a number');
      if ((field.min !== undefined && n < field.min) || (field.max !== undefined && n > field.max)) {
        return fail(`must be between ${field.min} and ${field.max}`);
      }
      return n;
    }
    case 'bool':
      return raw === true || raw === 1 || raw === '1' || raw === 'true' ? 1 : 0;
    case 'enum': {
      const value = empty ? (field.default ?? '') : String(raw);
      if (field.required && !value) return fail('required');
      return field.options.includes(value) ? value : fail(`must be one of ${field.options.join(', ')}`);
    }
    case 'email': {
      const value = empty ? '' : String(raw).trim();
      return value && !EMAIL.test(value) ? fail('not a valid email') : value;
    }
    case 'url': {
      const value = empty ? '' : String(raw).trim();
      return value && !isSafeUrl(value) ? fail('must be an http(s) or mailto link') : value;
    }
    case 'date': {
      const value = empty ? '' : String(raw).trim();
      return value && !DATE.test(value) ? fail('use YYYY-MM-DD') : value;
    }
    case 'media':
    case 'ref':
      if (empty) return field.required ? fail('required') : null;
      return String(raw);
    case 'links': {
      if (empty) return [];
      if (!Array.isArray(raw)) return fail('must be a list');
      const out = [];
      for (const item of raw) {
        const label = String(item?.label ?? '').trim();
        const url = String(item?.url ?? '').trim();
        if (!label && !url) continue;
        if (!label || !isSafeUrl(url)) return fail('every link needs a label and an http(s) URL');
        out.push({ label, url });
      }
      return out;
    }
    case 'strings': {
      if (empty) return [];
      if (!Array.isArray(raw)) return fail('must be a list');
      return raw.map((s) => String(s).trim()).filter(Boolean);
    }
    default: {
      const value = empty ? (field.default ?? '') : String(raw).trim();
      if (field.required && !value) return fail('required');
      return value;
    }
  }
}

/** Validates user input into a clean row of database-ready values. */
export function cleanInput(entityKey, input, existing = null) {
  const def = ENTITIES[entityKey];
  const errors = {};
  const row = {};
  for (const field of def.fields) {
    const raw = field.name in input ? input[field.name] : existing?.[field.name];
    const value = coerce(field, raw, errors);
    if (value !== undefined) row[field.name] = value;
  }
  const crossField = Object.keys(errors).length ? null : def.check?.(row);
  if (crossField) Object.assign(errors, crossField);
  if (Object.keys(errors).length) throw new ValidationError(errors);
  return row;
}

export function slugify(value) {
  const slug = String(value)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9一-鿿]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/, '');
  return slug || 'item';
}
