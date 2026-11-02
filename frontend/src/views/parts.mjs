import { html, raw, safeHref, t } from '../lib/html.mjs';

export const NAV = [
  { href: '/research.html', key: 'research', en: 'Research', zh: '研究方向' },
  { href: '/publications.html', key: 'publications', en: 'Publications', zh: '论文成果' },
  { href: '/data.html', key: 'data', en: 'Data', zh: '数据产品' },
  { href: '/people.html', key: 'people', en: 'People', zh: '团队成员' },
  { href: '/news.html', key: 'news', en: 'News', zh: '新闻动态' },
  { href: '/collaboration.html', key: 'collaboration', en: 'Collaboration', zh: '合作网络' },
];

export const arrow = raw(`<svg class="arrow" viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M4 10h11M10.5 5l5 5-5 5" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>`);

export const external = raw(`<svg class="arrow" viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M6 14 14 6M7 6h7v7" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>`);

/** Paragraphs for one language of a two-language text. */
export const paragraphs = (list, lang) => list.map((p) => html`<p class="${lang === 'zh' ? 't-zh' : 't-en'}" ${lang === 'zh' ? raw('lang="zh-CN"') : ''}>${p}</p>`);

export function picture(ctx, id, { alt, sizes = '100vw', cls = '', eager = false, style = '' } = {}) {
  const image = ctx.images[id];
  if (!image) return '';
  const meta = ctx.mediaById.get(id);
  return html`<img class="${cls}" src="${image.src}" srcset="${image.srcset}" sizes="${sizes}" width="${image.width}" height="${image.height}" alt="${alt ?? meta?.alt_en ?? ''}" loading="${eager ? 'eager' : 'lazy'}" decoding="async"${style ? raw(` style="${style}"`) : ''}>`;
}

/** A scientific figure: shown whole, never cropped, and enlarged on request. */
export function fig(ctx, id, { alt, en, zh, sizes = '(max-width: 1000px) 100vw, 860px' } = {}) {
  if (!ctx.images[id]) return '';
  const label = alt ?? ctx.mediaById.get(id)?.alt_en ?? en ?? 'figure';
  return html`<figure class="fig">
    <button class="fig__zoom" type="button" data-zoom aria-label="Enlarge: ${label}">${picture(ctx, id, { alt: label, sizes })}</button>
    ${en || zh ? html`<figcaption>${t(en, zh)}</figcaption>` : ''}
  </figure>`;
}

/** The real places shown as terrain blocks. See tools/build_earth.py. */
export const SCENES = {
  hengduan: { en: 'Hengduan Mountains', zh: '横断山区', contour: 300 },
  loess: { en: 'Loess Plateau and the Yellow River', zh: '黄土高原与黄河', contour: 200 },
  qilian: { en: 'Qilian Mountains', zh: '祁连山', contour: 300 },
  gorges: { en: 'Three Gorges and the middle Yangtze', zh: '三峡与长江中游', contour: 150 },
  snowy: { en: 'Snowy Mountains and the upper Murray', zh: '澳大利亚雪山与墨累河上游', contour: 150 },
  alps: { en: 'The Alps', zh: '阿尔卑斯山', contour: 250 },
};

export const pauseButton = () =>
  html`<button class="pause" type="button" data-pause aria-pressed="false" aria-label="Pause the animation" title="Pause or resume" hidden>${raw(`<svg viewBox="0 0 12 12" aria-hidden="true" focusable="false"><path d="M3 1.5h2v9H3zM7 1.5h2v9H7z"/></svg>`)}</button>`;

/** A still of the block, with a live one drawn over it where the browser can. */
export function terrainBlock(name) {
  const scene = SCENES[name];
  return html`<figure class="block" data-module="block" data-scene="${name}" data-contour="${scene.contour}">
    <img class="block__still" src="/earth/${name}-still.webp" width="960" height="640" alt="Terrain of ${scene.en}" decoding="async">
    <canvas class="block__canvas" aria-hidden="true"></canvas>
    <figcaption>${t(scene.en, scene.zh)}</figcaption>
    ${pauseButton()}
  </figure>`;
}

export const more = (href, en, zh, { out = false } = {}) =>
  html`<a class="more" href="${safeHref(href)}" ${out ? raw('target="_blank" rel="noopener"') : ''}>${t(en, zh)}${out ? external : arrow}</a>`;

/** The repeating page structure: a title in the left column, its content in the right. */
export const section = ({ id = '', en, zh, aside = '', cls = '', body }) =>
  html`<section class="sec ${cls}" ${id ? raw(`id="${id}"`) : ''}>
    <div class="wrap sec__grid">
      <header class="sec__head">
        <h2>${t(en, zh)}</h2>
        ${aside}
      </header>
      <div class="sec__body">${body}</div>
    </div>
  </section>`;

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
  return html`<li class="pub" data-year="${p.year}" data-topics="${p.topics.join('|')}" data-search="${search}">
    <h3 class="pub__title">${link ? html`<a href="${safeHref(link)}" target="_blank" rel="noopener">${p.title}</a>` : p.title}</h3>
    <p class="pub__authors">${piAuthors(p.authors)}</p>
    <p class="pub__venue"><cite>${p.venue || 'Preprint'}</cite>${location ? `, ${location}` : ''} (${p.year})</p>
    <p class="pub__actions">
      ${p.doi ? html`<a class="link" href="https://doi.org/${p.doi}" target="_blank" rel="noopener">DOI: ${p.doi}</a>` : ''}
      ${pdf ? html`<a class="link" href="${pdf.src}" target="_blank" rel="noopener">PDF</a>` : ''}
      <button class="link" type="button" data-copy="${apaCitation(p)}">${t('Copy citation', '复制引用')}</button>
    </p>
  </li>`;
}
