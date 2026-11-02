/**
 * Content admin. Everything is generated from /api/admin/schema, the same table
 * the server validates against, so a new field needs no change here. All text
 * reaches the page through textContent; nothing stored is ever parsed as HTML.
 */

const view = document.getElementById('view');
const nav = document.getElementById('nav');
const toastEl = document.getElementById('toast');
const authorInput = document.getElementById('author');
const pickerEl = document.getElementById('picker');
const tokenDialog = document.getElementById('token');

const store = {
  get: (area, key) => {
    try {
      return window[area].getItem(key) ?? '';
    } catch {
      return '';
    }
  },
  set: (area, key, value) => {
    try {
      window[area].setItem(key, value);
    } catch {
      /* Storage blocked: the value just lasts for this page. */
    }
  },
};

let schema = null;
let token = store.get('sessionStorage', 'lab-token');
authorInput.value = store.get('localStorage', 'lab-author');
authorInput.addEventListener('change', () => store.set('localStorage', 'lab-author', authorInput.value.trim()));

/** Creates an element. Strings become text nodes, so stored content stays inert. */
function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props ?? {})) {
    if (value === undefined || value === null || value === false) continue;
    if (key.startsWith('on')) el.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key === 'class') el.className = value;
    else if (key in el && key !== 'list' && key !== 'form') el[key] = value;
    else el.setAttribute(key, value === true ? '' : value);
  }
  el.append(...children.flat().filter((child) => child !== null && child !== undefined && child !== false));
  return el;
}

/** Replaces the main view. replaceChildren() would print arrays and nulls as text. */
const show = (...nodes) => view.replaceChildren(...nodes.flat(Infinity).filter(Boolean));

let toastTimer;
function toast(message, { error = false } = {}) {
  toastEl.textContent = message;
  toastEl.className = error ? 'toast toast--error' : 'toast';
  toastEl.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (toastEl.hidden = true), error ? 6000 : 2400);
}

function askToken() {
  return new Promise((resolve) => {
    tokenDialog.addEventListener('close', () => resolve(document.getElementById('tokeninput').value), { once: true });
    tokenDialog.showModal();
  });
}

async function api(path, { method = 'GET', body, raw } = {}) {
  const headers = { 'X-Lab-Author': encodeURIComponent(authorInput.value.trim() || 'admin') };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (raw) headers['Content-Type'] = 'application/octet-stream';

  const response = await fetch(path, { method, headers, body: raw ?? (body === undefined ? undefined : JSON.stringify(body)) });
  if (response.status === 401) {
    token = await askToken();
    store.set('sessionStorage', 'lab-token', token);
    return api(path, { method, body, raw });
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(data.error ?? `Request failed (${response.status})`), { fields: data.fields, log: data.log });
  return data;
}

const entityOf = (key) => schema.entities.find((e) => e.key === key);
const mediaUrl = (m) => `/media/${m.sha256}.${m.ext}`;
const isImage = (m) => m.mime.startsWith('image/');
const fmtDate = (value) => (value ? String(value).replace('T', ' ').slice(0, 16) : '');
const fmtBytes = (n) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`);

function page(crumb, title, ...actions) {
  document.title = `${title} · Lab admin`;
  return h('div', { class: 'head' }, h('div', {}, crumb ? h('span', { class: 'crumb' }, crumb) : null, h('h1', {}, title)), h('div', { class: 'row' }, actions));
}

/* Field editors. Each returns { el, get } and is chosen by field.type. */

function textEditor(field, value, type = 'text') {
  const input = h('input', { type, id: `f-${field.name}`, value: value ?? '', required: field.required });
  return { el: input, get: () => input.value, set: (v) => (input.value = v ?? '') };
}

function areaEditor(field, value) {
  const area = h('textarea', { id: `f-${field.name}`, value: value ?? '', required: field.required, class: field.type === 'markdown' ? 'code' : undefined });
  return { el: area, get: () => area.value, set: (v) => (area.value = v ?? '') };
}

function numberEditor(field, value) {
  const input = h('input', { type: 'number', id: `f-${field.name}`, value: value ?? '', required: field.required, step: field.type === 'real' ? 'any' : '1' });
  return { el: input, get: () => input.value, set: (v) => (input.value = v ?? '') };
}

function boolEditor(field, value) {
  const box = h('input', { type: 'checkbox', id: `f-${field.name}`, checked: Boolean(value) });
  return { el: box, get: () => box.checked };
}

function enumEditor(field, value) {
  const select = h('select', { id: `f-${field.name}` }, field.options.map((o) => h('option', { value: o, selected: o === value }, o || '(none)')));
  return { el: select, get: () => select.value };
}

async function refEditor(field, value) {
  const rows = await api(`/api/admin/entities/${field.ref}?status=published`);
  const select = h(
    'select',
    { id: `f-${field.name}`, required: field.required },
    h('option', { value: '' }, '(choose)'),
    rows.map((r) => h('option', { value: r.id, selected: r.id === value }, r._title)),
  );
  return { el: select, get: () => select.value };
}

function stringsEditor(field, value) {
  const list = value ?? [];
  const area = field.multiline
    ? h('textarea', { id: `f-${field.name}`, value: list.join('\n') })
    : h('input', { id: `f-${field.name}`, value: list.join(', ') });
  return {
    el: h('div', { class: 'field' }, area, h('span', { class: 'field__help' }, field.multiline ? 'One per line' : 'Separate with commas')),
    get: () => area.value.split(field.multiline ? '\n' : ',').map((s) => s.trim()).filter(Boolean),
  };
}

function linksEditor(field, value) {
  const rows = h('div', {});
  const addRow = (link = { label: '', url: '' }) => {
    const row = h(
      'div',
      { class: 'linkrow' },
      h('input', { placeholder: 'Label', 'aria-label': 'Link label', value: link.label }),
      h('input', { placeholder: 'https://', 'aria-label': 'Link address', value: link.url }),
      h('button', { type: 'button', class: 'btn btn--small', onclick: () => row.remove() }, 'Remove'),
    );
    rows.append(row);
  };
  (value ?? []).forEach(addRow);
  return {
    el: h('div', {}, rows, h('button', { type: 'button', class: 'btn btn--small', onclick: () => addRow() }, 'Add link')),
    get: () => [...rows.children].map((row) => {
      const [label, url] = row.querySelectorAll('input');
      return { label: label.value, url: url.value };
    }),
  };
}

function mediaEditor(field, value) {
  let current = value ?? '';
  const preview = h('div', { class: 'mediafield' });
  const render = async () => {
    preview.replaceChildren();
    if (current) {
      const item = (await api('/api/admin/media?status=all')).find((m) => m.id === current);
      if (item) {
        preview.append(isImage(item) ? h('img', { src: mediaUrl(item), alt: item.alt_en }) : h('span', { class: 'mediafield__file' }, item.ext.toUpperCase()));
        preview.append(h('span', {}, item.filename));
      }
    }
    preview.append(h('button', { type: 'button', class: 'btn btn--small', onclick: choose }, current ? 'Change' : 'Choose'));
    if (current) preview.append(h('button', { type: 'button', class: 'btn btn--small', onclick: clear }, 'Clear'));
  };
  const choose = async () => {
    const picked = await pickMedia(field.accept);
    if (picked) {
      current = picked.id;
      render();
    }
  };
  const clear = () => {
    current = '';
    render();
  };
  render();
  return { el: preview, get: () => current };
}

const EDITORS = {
  longtext: areaEditor,
  markdown: areaEditor,
  int: numberEditor,
  real: numberEditor,
  bool: boolEditor,
  enum: enumEditor,
  ref: refEditor,
  strings: stringsEditor,
  links: linksEditor,
  media: mediaEditor,
  email: (f, v) => textEditor(f, v, 'email'),
  date: (f, v) => textEditor(f, v, 'date'),
};

function pickMedia(accept) {
  return new Promise(async (resolve) => {
    const finish = (value) => {
      pickerEl.close();
      resolve(value);
    };
    const items = (await api('/api/admin/media')).filter((m) => (accept === 'pdf' ? m.mime === 'application/pdf' : accept === 'image' ? isImage(m) : true));
    const grid = h('div', { class: 'gallery' });
    const paint = (query) => {
      const q = query.trim().toLowerCase();
      grid.replaceChildren(...items.filter((m) => `${m.filename} ${m.alt_en}`.toLowerCase().includes(q)).map((m) => mediaTile(m, () => finish(m))));
    };
    pickerEl.replaceChildren(
      h(
        'div',
        { class: 'head' },
        h('h2', {}, 'Choose a file'),
        h(
          'div',
          { class: 'row' },
          h('input', { class: 'search', type: 'search', placeholder: 'Filter', 'aria-label': 'Filter files', oninput: (e) => paint(e.target.value) }),
          h('input', {
            type: 'file',
            'aria-label': 'Upload a new file',
            onchange: async (e) => {
              const [file] = e.target.files;
              if (file) finish(await upload(file));
            },
          }),
          h('button', { type: 'button', class: 'btn', onclick: () => finish(null) }, 'Cancel'),
        ),
      ),
      grid,
    );
    paint('');
    pickerEl.showModal();
  });
}

async function upload(file) {
  try {
    const row = await api(`/api/admin/media?filename=${encodeURIComponent(file.name)}`, { method: 'POST', raw: file });
    toast(`Uploaded ${row.filename}`);
    return row;
  } catch (error) {
    toast(error.message, { error: true });
    return null;
  }
}

function mediaTile(m, onclick) {
  return h(
    'button',
    { type: 'button', class: 'tile', onclick, title: m.filename },
    isImage(m) ? h('img', { src: mediaUrl(m), alt: m.alt_en, loading: 'lazy' }) : h('span', { class: 'tile__file' }, m.ext.toUpperCase()),
    h('span', {}, m.filename),
  );
}

/* Views */

async function dashboard() {
  const status = await api('/api/admin/status');
  const tiles = schema.entities.map((e) => {
    const c = status.counts[e.key] ?? {};
    const extra = [c.draft ? `${c.draft} draft` : '', c.archived ? `${c.archived} archived` : ''].filter(Boolean).join(', ');
    return h('a', { class: 'stat', href: `#/e/${e.key}` }, h('b', {}, c.published ?? 0), h('span', {}, e.label), h('span', { class: 'field__help' }, extra));
  });
  show(
    page(null, 'Content'),
    h('div', { class: 'tiles' }, tiles, h('a', { class: 'stat', href: '#/media' }, h('b', {}, status.media.n), h('span', {}, 'Files'), h('span', { class: 'field__help' }, fmtBytes(status.media.bytes)))),
    h(
      'div',
      { class: 'row' },
      h('a', { class: 'btn btn--primary', href: '#/e/publications/new' }, 'Add a paper'),
      h('a', { class: 'btn', href: '#/e/news/new' }, 'Add news'),
      h('a', { class: 'btn', href: '#/e/people/new' }, 'Add a person'),
      h('a', { class: 'btn', href: '#/publish' }, 'Publish the site'),
    ),
    h(
      'div',
      { class: 'section' },
      h('h2', {}, 'Archive'),
      h('p', {}, `${status.revisions} recorded changes. Latest snapshot: ${status.latestRelease ? `${status.latestRelease.id} (${fmtDate(status.latestRelease.created_at)})` : 'none yet'}.`),
    ),
  );
}

async function entityList(key) {
  const entity = entityOf(key);
  const results = h('div', { class: 'items' });
  const search = h('input', { class: 'search', type: 'search', placeholder: `Search ${entity.label.toLowerCase()}`, 'aria-label': 'Search' });
  const filter = h('select', { class: 'statusfilter', 'aria-label': 'Status' }, ['all', ...schema.statuses].map((s) => h('option', { value: s }, s)));

  const load = async () => {
    const params = new URLSearchParams({ status: filter.value });
    if (search.value.trim()) params.set('q', search.value.trim());
    const rows = await api(`/api/admin/entities/${key}?${params}`);
    results.replaceChildren(
      ...(rows.length
        ? rows.map((r) =>
            h(
              'a',
              { class: 'item', href: `#/e/${key}/${encodeURIComponent(r.id)}` },
              h('span', { class: 'item__title' }, r._title || r.id),
              h('span', { class: 'badge badge--' + r.status }, r.status),
              h('span', { class: 'item__sub' }, r._subtitle ?? ''),
            ),
          )
        : [h('p', { class: 'empty' }, 'Nothing here.')]),
    );
  };

  let timer;
  search.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(load, 180);
  });
  filter.addEventListener('change', load);

  show(page('Content', entity.label, h('a', { class: 'btn btn--primary', href: `#/e/${key}/new` }, 'New')), h('div', { class: 'row', 'data-tools': '' }, search, filter), h('div', { class: 'section' }, results));
  await load();
}

async function revisionList(entity, id) {
  const rows = await api(`/api/admin/revisions?entity=${entity}&id=${encodeURIComponent(id)}&limit=30`);
  if (!rows.length) return null;
  return h(
    'div',
    { class: 'section' },
    h('h2', {}, 'History'),
    h('div', { class: 'items' }, rows.map((r) => revisionRow(r, () => route()))),
  );
}

function revisionRow(rev, after) {
  const canRollback = Boolean(rev.before);
  return h(
    'div',
    { class: 'item' },
    h('span', { class: 'item__title' }, `${rev.action} · ${rev.entity} · ${rev.entity_id}`),
    canRollback
      ? h(
          'button',
          {
            type: 'button',
            class: 'btn btn--small badge',
            onclick: async () => {
              if (!confirm('Put this item back to how it was before this change?')) return;
              try {
                await api(`/api/admin/revisions/${encodeURIComponent(rev.id)}/rollback`, { method: 'POST', body: {} });
                toast('Rolled back');
                after();
              } catch (error) {
                toast(error.message, { error: true });
              }
            },
          },
          'Roll back',
        )
      : null,
    h('span', { class: 'item__sub' }, `${fmtDate(rev.created_at)} · ${rev.author}${rev.note ? ` · ${rev.note}` : ''}`),
  );
}

async function entityForm(key, id) {
  const entity = entityOf(key);
  const isNew = id === 'new';
  const record = isNew ? {} : await api(`/api/admin/entities/${key}/${encodeURIComponent(id)}`);
  const editors = {};
  const errors = {};
  const form = h('form', { class: 'form', novalidate: true });

  if (key === 'publications' && isNew) form.append(doiLookup(editors));

  for (const field of entity.fields) {
    const initial = isNew ? field.default : record[field.name];
    const build = EDITORS[field.type] ?? textEditor;
    const editor = await build(field, initial);
    editors[field.name] = editor;
    errors[field.name] = h('span', { class: 'field__error', hidden: true });
    if (field.type === 'bool') {
      form.append(h('div', { class: 'field field--bool' }, h('label', {}, editor.el, field.label), errors[field.name]));
    } else {
      form.append(
        h(
          'div',
          { class: 'field' },
          h('label', { htmlFor: `f-${field.name}` }, `${field.label}${field.required ? ' *' : ''}`),
          editor.el,
          field.help ? h('span', { class: 'field__help' }, field.help) : null,
          errors[field.name],
        ),
      );
    }
  }

  const status = h('select', { 'aria-label': 'Status' }, ['published', 'draft'].map((s) => h('option', { value: s, selected: (record.status ?? 'published') === s }, s)));

  const save = async (event) => {
    event.preventDefault();
    Object.values(errors).forEach((el) => (el.hidden = true));
    const body = { status: record.status === 'archived' ? 'archived' : status.value };
    for (const [name, editor] of Object.entries(editors)) body[name] = editor.get();
    try {
      const saved = isNew
        ? await api(`/api/admin/entities/${key}`, { method: 'POST', body })
        : await api(`/api/admin/entities/${key}/${encodeURIComponent(id)}`, { method: 'PUT', body });
      toast('Saved. Publish the site to make it public.');
      location.hash = `#/e/${key}/${encodeURIComponent(saved.id)}`;
      if (!isNew) route();
    } catch (error) {
      for (const [name, message] of Object.entries(error.fields ?? {})) {
        if (!errors[name]) continue;
        errors[name].textContent = message;
        errors[name].hidden = false;
      }
      toast(error.fields ? 'Please fix the marked fields.' : error.message, { error: true });
    }
  };
  form.addEventListener('submit', save);

  const act = (label, path, { method = 'POST', ask, cls = 'btn', done } = {}) =>
    h(
      'button',
      {
        type: 'button',
        class: cls,
        onclick: async () => {
          if (ask && !confirm(ask)) return;
          try {
            await api(`/api/admin/entities/${key}/${encodeURIComponent(id)}${path}`, { method, body: method === 'POST' ? {} : undefined });
            toast(`${label} done`);
            if (done) location.hash = done;
            else route();
          } catch (error) {
            toast(error.message, { error: true });
          }
        },
      },
      label,
    );

  form.append(
    h(
      'div',
      { class: 'formbar' },
      h('button', { class: 'btn btn--primary', type: 'submit' }, isNew ? 'Create' : 'Save'),
      record.status === 'archived' ? null : status,
      h('span', { class: 'spacer' }),
      isNew ? null : record.status === 'archived' ? act('Restore', '/unarchive') : act('Archive', '/archive', { ask: 'Archive this item? It leaves the public site but stays in the database.' }),
      record.status === 'archived'
        ? act('Delete', '', { method: 'DELETE', cls: 'btn btn--danger', ask: 'Delete this record? Its history is kept, so it can still be rolled back.', done: `#/e/${key}` })
        : null,
    ),
  );

  const history = isNew ? null : await revisionList(key, id);
  show(page(entity.label, isNew ? `New: ${entity.label}` : record._title || id, h('a', { class: 'btn', href: `#/e/${key}` }, 'Back')), form, history);
}

function doiLookup(editors) {
  const input = h('input', { placeholder: '10.1038/s41561-025-01897-9', 'aria-label': 'DOI to look up' });
  const button = h(
    'button',
    {
      type: 'button',
      class: 'btn',
      onclick: async () => {
        button.disabled = true;
        try {
          const found = await api('/api/admin/lookup-doi', { method: 'POST', body: { doi: input.value } });
          for (const [name, value] of Object.entries(found)) if (value !== null && value !== '') editors[name]?.set?.(value);
          toast('Filled from Crossref. Please check it, especially author names.');
        } catch (error) {
          toast(error.message, { error: true });
        } finally {
          button.disabled = false;
        }
      },
    },
    'Fill from DOI',
  );
  return h('div', { class: 'lookup' }, input, button);
}

async function mediaView() {
  const grid = h('div', { class: 'gallery' });
  const editor = h('div', { class: 'section' });

  const edit = (m) => {
    const en = h('input', { id: 'alt-en', value: m.alt_en });
    const zh = h('input', { id: 'alt-zh', value: m.alt_zh });
    editor.replaceChildren(
      h('h2', {}, m.filename),
      h('p', { class: 'field__help' }, `${m.mime}, ${fmtBytes(m.bytes)}`),
      h(
        'form',
        {
          class: 'form',
          onsubmit: async (e) => {
            e.preventDefault();
            try {
              await api(`/api/admin/media/${m.id}`, { method: 'PUT', body: { alt_en: en.value, alt_zh: zh.value } });
              m.alt_en = en.value;
              m.alt_zh = zh.value;
              toast('Saved');
            } catch (error) {
              toast(error.message, { error: true });
            }
          },
        },
        h('div', { class: 'field' }, h('label', { htmlFor: 'alt-en' }, 'Description (English)'), en),
        h('div', { class: 'field' }, h('label', { htmlFor: 'alt-zh' }, 'Description (中文)'), zh),
        h('div', { class: 'row' }, h('button', { class: 'btn btn--primary', type: 'submit' }, 'Save')),
      ),
    );
    editor.scrollIntoView({ behavior: 'smooth' });
  };

  const load = async () => {
    const items = await api('/api/admin/media');
    grid.replaceChildren(...items.map((m) => mediaTile(m, () => edit(m))));
  };

  const send = async (files) => {
    for (const file of files) await upload(file);
    await load();
  };

  const drop = h(
    'div',
    {
      class: 'drop',
      ondragover: (e) => {
        e.preventDefault();
        drop.classList.add('is-over');
      },
      ondragleave: () => drop.classList.remove('is-over'),
      ondrop: (e) => {
        e.preventDefault();
        drop.classList.remove('is-over');
        send([...e.dataTransfer.files]);
      },
    },
    h('p', {}, 'Drop images or PDFs here. Originals are archived unchanged; the site makes web sizes itself.'),
    h('input', { type: 'file', multiple: true, 'aria-label': 'Upload files', onchange: (e) => send([...e.target.files]) }),
  );

  show(page('Content', 'Files'), drop, grid, editor);
  await load();
}

async function settingsView() {
  const settings = await api('/api/admin/settings');
  const blocks = Object.entries(settings).map(([key, value]) => {
    const area = h('textarea', { class: 'code', 'aria-label': key, value: JSON.stringify(value, null, 2), spellcheck: false });
    const save = async () => {
      let parsed;
      try {
        parsed = JSON.parse(area.value);
      } catch (error) {
        toast(`That is not valid JSON: ${error.message}`, { error: true });
        return;
      }
      try {
        await api(`/api/admin/settings/${encodeURIComponent(key)}`, { method: 'PUT', body: { value: parsed } });
        toast('Saved. Publish the site to make it public.');
      } catch (error) {
        toast(error.message, { error: true });
      }
    };
    return h('section', { class: 'setting' }, h('h2', {}, key), area, h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn', onclick: save }, 'Save')));
  });
  show(page('Content', 'Site settings'), h('p', { class: 'field__help' }, 'Lab details, homepage figures, recruitment text and the water-budget numbers. Edit carefully: each block must stay valid JSON.'), h('div', { class: 'section' }, blocks));
}

async function historyView() {
  const rows = await api('/api/admin/revisions?limit=200');
  show(
    page('Archive', 'Change history'),
    h('div', { class: 'items' }, rows.length ? rows.map((r) => revisionRow(r, route)) : h('p', { class: 'empty' }, 'No changes recorded yet.')),
  );
}

async function releasesView() {
  const [rows] = await Promise.all([api('/api/admin/releases')]);
  const note = h('input', { placeholder: 'What this snapshot is for', 'aria-label': 'Snapshot note' });

  const create = async () => {
    try {
      const made = await api('/api/admin/releases', { method: 'POST', body: { note: note.value } });
      toast(`Snapshot ${made.id ?? ''} saved`);
      route();
    } catch (error) {
      toast(error.message, { error: true });
    }
  };
  const verify = async () => {
    try {
      const report = await api('/api/admin/releases/verify');
      const bad = (report.results ?? report).filter?.((r) => !r.ok) ?? [];
      toast(bad.length ? `${bad.length} snapshot(s) failed their checksum` : 'All snapshots match their checksums', { error: bad.length > 0 });
    } catch (error) {
      toast(error.message, { error: true });
    }
  };
  const restore = async (id) => {
    if (!confirm(`Replace all current content with snapshot ${id}? The current state is recorded first, so this can be undone.`)) return;
    try {
      await api(`/api/admin/releases/${encodeURIComponent(id)}/restore`, { method: 'POST', body: {} });
      toast('Restored');
      route();
    } catch (error) {
      toast(error.message, { error: true });
    }
  };

  show(
    page('Archive', 'Snapshots', h('button', { type: 'button', class: 'btn', onclick: verify }, 'Verify checksums')),
    h('div', { class: 'row' }, note, h('button', { type: 'button', class: 'btn btn--primary', onclick: create }, 'Save a snapshot')),
    h(
      'div',
      { class: 'section items' },
      rows.length
        ? rows.map((r) =>
            h(
              'div',
              { class: 'item' },
              h('span', { class: 'item__title' }, r.id),
              h('button', { type: 'button', class: 'btn btn--small badge', onclick: () => restore(r.id) }, 'Restore'),
              h('span', { class: 'item__sub' }, `${fmtDate(r.created_at)}${r.note ? ` · ${r.note}` : ''}`),
            ),
          )
        : h('p', { class: 'empty' }, 'No snapshots yet. Publishing the site saves one automatically.'),
    ),
  );
}

function publishView() {
  const note = h('input', { placeholder: 'What changed, e.g. Added a 2026 paper', 'aria-label': 'What changed' });
  const log = h('pre', { class: 'log', hidden: true });
  const button = h(
    'button',
    {
      type: 'button',
      class: 'btn btn--primary',
      onclick: async () => {
        button.disabled = true;
        button.textContent = 'Publishing, about a minute...';
        log.hidden = true;
        try {
          const result = await api('/api/admin/publish', { method: 'POST', body: { note: note.value } });
          log.textContent = result.log;
          toast('Built. Commit and push to put it live.');
        } catch (error) {
          log.textContent = error.log ?? error.message;
          toast('Publish failed. The live files were not changed.', { error: true });
        } finally {
          log.hidden = false;
          button.disabled = false;
          button.textContent = 'Build the site';
        }
      },
    },
    'Build the site',
  );

  show(
    page('Site', 'Publish'),
    h(
      'ol',
      { class: 'steps' },
      h('li', {}, 'Build the site below. This saves a snapshot, regenerates every page and checks all links.'),
      h('li', {}, 'In a terminal, review with ', h('code', {}, 'git status'), '.'),
      h('li', {}, 'Commit and push to ', h('code', {}, 'main'), '. GitHub Pages updates within a few minutes.'),
    ),
    h('div', { class: 'form section' }, note, h('div', { class: 'row' }, button)),
    h('div', { class: 'section' }, log),
  );
}

function renderNav(current) {
  const link = (href, label, count) => h('a', { href, 'aria-current': current === href ? 'page' : undefined }, h('span', {}, label), count === undefined ? null : h('small', {}, count));
  nav.replaceChildren(
    link('#/', 'Overview'),
    h('h2', {}, 'Content'),
    ...schema.entities.map((e) => link(`#/e/${e.key}`, e.label)),
    link('#/media', 'Files'),
    link('#/settings', 'Site settings'),
    h('h2', {}, 'Archive'),
    link('#/history', 'Change history'),
    link('#/releases', 'Snapshots'),
    h('h2', {}, 'Site'),
    link('#/publish', 'Publish'),
  );
}

async function route() {
  const parts = location.hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent);
  const [section, key, id] = parts;
  renderNav(section === 'e' ? `#/e/${key}` : section ? `#/${section}` : '#/');
  window.scrollTo({ top: 0 });
  try {
    if (section === 'e' && entityOf(key)) await (id ? entityForm(key, id) : entityList(key));
    else if (section === 'media') await mediaView();
    else if (section === 'settings') await settingsView();
    else if (section === 'history') await historyView();
    else if (section === 'releases') await releasesView();
    else if (section === 'publish') publishView();
    else await dashboard();
  } catch (error) {
    show(page(null, 'Something went wrong'), h('p', {}, error.message));
  }
  view.focus({ preventScroll: true });
}

async function start() {
  try {
    schema = await api('/api/admin/schema');
  } catch (error) {
    show(page(null, 'Cannot reach the back end'), h('p', {}, error.message));
    return;
  }
  addEventListener('hashchange', route);
  route();
}

start();
