import { html, raw, safeHref, t } from '../lib/html.mjs';

export const NAV = [
  { href: '/research.html', key: 'research', en: 'Research', zh: '研究方向' },
  { href: '/publications.html', key: 'publications', en: 'Publications', zh: '论文成果' },
  { href: '/data.html', key: 'data', en: 'Data', zh: '数据产品' },
  { href: '/people.html', key: 'people', en: 'People', zh: '团队成员' },
  { href: '/news.html', key: 'news', en: 'News', zh: '新闻动态' },
  { href: '/collaboration.html', key: 'collaboration', en: 'Collaboration', zh: '合作网络' },
];

/** The group's badge reduced to one mark: a disc crossed by a river. */
export const mark = raw(`<svg class="mark" viewBox="0 0 32 32" aria-hidden="true" focusable="false"><circle cx="16" cy="16" r="16" fill="currentColor"/><path d="M-1 12c6-4 9 3 15 2s9-8 19-3v6c-9-4-12 3-18 4S4 16-1 19z" fill="var(--mark-river, var(--lime))"/></svg>`);

export const arrow = raw(`<svg class="arrow" viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M4 10h11M10.5 5l5 5-5 5" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>`);

export const external = raw(`<svg class="arrow arrow--out" viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M6 14 14 6M7 6h7v7" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>`);

export function picture(ctx, id, { alt, sizes = '100vw', cls = '', eager = false, style = '' } = {}) {
  const image = ctx.images[id];
  if (!image) return '';
  const meta = ctx.mediaById.get(id);
  return html`<img class="${cls}" src="${image.src}" srcset="${image.srcset}" sizes="${sizes}" width="${image.width}" height="${image.height}" alt="${alt ?? meta?.alt_en ?? ''}" loading="${eager ? 'eager' : 'lazy'}" decoding="async" style="background-color:${image.color};${style}">`;
}

export const eyebrow = (index, en, zh) => html`<p class="eyebrow"><span class="eyebrow__i">/${index}</span>${t(en, zh)}</p>`;

export const button = (href, en, zh, { cls = '', out = false } = {}) =>
  html`<a class="btn ${cls}" href="${safeHref(href)}" ${out ? raw('target="_blank" rel="noopener"') : ''} data-magnetic><span>${t(en, zh)}</span>${out ? external : arrow}</a>`;

/** Splits text into masked lines' worth of words for the reveal animation. */
export const reveal = (en, zh) => t(en, zh);

export const apaCitation = (p) => {
  const location = [p.volume && `${p.volume}${p.issue ? `(${p.issue})` : ''}`, p.pages].filter(Boolean).join(', ');
  const venue = [p.venue, location].filter(Boolean).join(', ');
  const link = p.doi ? `https://doi.org/${p.doi}` : p.url;
  return `${p.authors} (${p.year}). ${p.title}.${venue ? ` ${venue}.` : ''}${link ? ` ${link}` : ''}`;
};

export const pubLink = (p) => (p.doi ? `https://doi.org/${p.doi}` : p.url);

export const piAuthors = (authors) => {
  const parts = authors.split(/(Zhang, Y\.)/);
  return parts.map((part) => (part === 'Zhang, Y.' ? html`<b>${part}</b>` : part));
};

export function pubItem(p, ctx) {
  const location = [p.volume && `${p.volume}${p.issue ? `(${p.issue})` : ''}`, p.pages].filter(Boolean).join(', ');
  const link = pubLink(p);
  const search = `${p.title} ${p.authors} ${p.venue} ${p.year} ${p.doi}`.toLowerCase();
  const pdf = p.pdf_id ? ctx.files[p.pdf_id] : null;
  return html`<li class="pub${p.featured ? ' pub--featured' : ''}" data-year="${p.year}" data-topics="${p.topics.join('|')}" data-search="${search}">
    <p class="pub__venue"><span>${p.venue || 'Preprint'}</span>${location ? html`<span class="pub__loc">${location}</span>` : ''}</p>
    <h3 class="pub__title">${link ? html`<a href="${safeHref(link)}" target="_blank" rel="noopener">${p.title}</a>` : p.title}</h3>
    <p class="pub__authors">${piAuthors(p.authors)}</p>
    <div class="pub__actions">
      ${p.doi ? html`<a class="link" href="https://doi.org/${p.doi}" target="_blank" rel="noopener">DOI</a>` : ''}
      ${pdf ? html`<a class="link" href="${pdf.src}" target="_blank" rel="noopener">PDF</a>` : ''}
      <button class="link" type="button" data-copy="${apaCitation(p)}">${t('Copy citation', '复制引用')}</button>
    </div>
  </li>`;
}

/** Hand-drawn theme pictograms, drawn in currentColor so they sit flat on any plane. */
export const pictogram = {
  'water-cycle': raw(`<svg class="pictogram" viewBox="0 0 200 200" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="10"><path class="spin" d="M100 20a80 80 0 0 1 80 80"/><path class="spin spin--b" d="M100 180a80 80 0 0 1-80-80"/></g><path d="M100 58c20 26 32 40 32 56a32 32 0 0 1-64 0c0-16 12-30 32-56z" fill="currentColor"/></svg>`),
  'water-security': raw(`<svg class="pictogram" viewBox="0 0 200 200" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="10"><path class="wave" d="M0 70c25-18 50-18 75 0s50 18 75 0 50-18 75 0"/><path class="wave wave--b" d="M-25 110c25-18 50-18 75 0s50 18 75 0 50-18 75 0"/><path class="wave" d="M0 150c25-18 50-18 75 0s50 18 75 0 50-18 75 0"/></g></svg>`),
  'water-innovation': raw(`<svg class="pictogram" viewBox="0 0 200 200" aria-hidden="true"><g fill="currentColor">${[
    [90, 20], [70, 50], [90, 50], [110, 50], [50, 80], [70, 80], [90, 80], [110, 80], [130, 80], [30, 110], [50, 110], [70, 110], [90, 110], [110, 110], [130, 110], [150, 110], [50, 140], [70, 140], [90, 140], [110, 140], [130, 140], [70, 170], [90, 170], [110, 170],
  ].map(([x, y], i) => `<rect class="px" style="--i:${i}" x="${x}" y="${y}" width="17" height="17"/>`).join('')}</g></svg>`),
};
