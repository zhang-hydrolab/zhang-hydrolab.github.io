/** Minimal HTML templating. Interpolated values are escaped unless wrapped in raw(). */
class Raw {
  constructor(value) {
    this.value = value;
  }

  toString() {
    return this.value;
  }
}

export const raw = (value) => new Raw(String(value));

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (c) => ESCAPES[c]);

function render(value) {
  if (value === null || value === undefined || value === false || value === true) return '';
  if (value instanceof Raw) return value.value;
  if (Array.isArray(value)) return value.map(render).join('');
  return escapeHtml(value);
}

export function html(strings, ...values) {
  let out = strings[0];
  values.forEach((value, i) => {
    out += render(value) + strings[i + 1];
  });
  return new Raw(out);
}

/** Bilingual text. Falls back to whichever language exists. */
export function t(en, zh) {
  const a = en || zh || '';
  const b = zh || en || '';
  if (a === b) return html`${a}`;
  return html`<span class="t-en">${a}</span><span class="t-zh" lang="zh-CN">${b}</span>`;
}

/** Only web and mail links ever reach an href. */
export function safeHref(url) {
  try {
    const parsed = new URL(url, 'https://zhang-hydrolab.github.io');
    return ['http:', 'https:', 'mailto:'].includes(parsed.protocol) ? url : '#';
  } catch {
    return '#';
  }
}

export const jsonScript = (id, data) =>
  raw(`<script type="application/json" id="${id}">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`);

export const stripTags = (value) => String(value).replace(/<[^>]+>/g, '');
