import { html, raw, safeHref, t } from '../lib/html.mjs';

export const NAV = [
  { href: '/research.html', key: 'research', en: 'Research', zh: '研究方向' },
  { href: '/publications.html', key: 'publications', en: 'Publications', zh: '论文成果' },
  { href: '/data.html', key: 'data', en: 'Data', zh: '数据产品' },
  { href: '/models.html', key: 'models', en: 'Models', zh: '模型产品' },
  { href: '/people.html', key: 'people', en: 'People', zh: '团队成员' },
  { href: '/news.html', key: 'news', en: 'News', zh: '新闻动态' },
  { href: '/collaboration.html', key: 'collaboration', en: 'Collaboration', zh: '合作网络' },
];

export const arrow = raw(`<svg class="arrow" viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M4 10h11M10.5 5l5 5-5 5" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>`);

export const external = raw(`<svg class="arrow" viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M6 14 14 6M7 6h7v7" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>`);

/** Paragraphs for one language of a two-language text. */
export const paragraphs = (list, lang) => list.map((p) => html`<p class="${lang === 'zh' ? 't-zh' : 't-en'}" ${lang === 'zh' ? raw('lang="zh-CN"') : ''}>${p}</p>`);

/** The principal investigator's positions and honours, from site.pi.honours. */
export function piHonours(ctx, cls = '') {
  const list = ctx.api.site['site.pi']?.honours ?? [];
  if (!list.length) return '';
  return html`<ul class="honours ${cls}">${list.map((h) => html`<li>${t(h.en, h.zh)}</li>`)}</ul>`;
}

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

/** The live view of each research programme, on real data. See client/modules/theme.js. */
export const THEME_VIEWS = {
  'water-cycle': {
    view: 'flow',
    alt: 'Terrain of the Hengduan Mountains with its river network, rain and rising vapour',
    readout: ['Rain falls, vegetation returns vapour, and runoff travels down the river network', '降水落地，植被蒸散发上升，径流沿河网下泄'],
    caption: [
      'Hengduan Mountains: 1 km terrain, with rivers routed from precipitation minus evapotranspiration (CRU TS 4.09; PML-V2.2). Rain and vapour are drawn to show the cycle, not measured amounts.',
      '横断山区：1 km 地形，河网由降水减蒸散发（CRU TS 4.09；PML-V2.2）汇流得到。雨滴与水汽仅示意水循环过程，并非实测量。',
    ],
  },
  'water-security': {
    view: 'flood',
    alt: 'Terrain of the Three Gorges and the middle Yangtze in a storm and a flood, with a river gauge above its flood warning line; in motion, a drought follows and dries the smaller streams',
    readout: ['Storm, flood and drought on the middle Yangtze', '长江中游的暴雨、洪水与干旱'],
    steps: [['Storm', '暴雨'], ['Flood', '洪水'], ['Drought', '干旱']],
    caption: [
      'Three Gorges and the middle Yangtze on the 1 km terrain. A storm rains on the upper catchment; the flood that follows covers the land below a water level rising to 24 m above the nearest channel, from the height above the nearest drainage (HAND; Nobre et al., 2011); a drought then dries the smaller streams first. The gauge on the Yangtze near Shashi marks a flood warning (red) and a low-flow warning (amber). Rain, water levels and the drought illustrate the processes studied; they are not observations or forecasts.',
      '三峡与长江中游（1 km 地形）。暴雨降落在上游流域；随后的洪水依据相对最近河道高差（HAND；Nobre 等，2011）显示水位升至高出最近河道 24 米过程中被淹没的土地；之后干旱先使较小的支流断流。长江沙市附近的水位标尺标出洪水预警线（红）与低水位预警线（橙）。降雨、水位与干旱过程仅示意研究内容，并非观测或预报。',
    ],
  },
  'water-innovation': {
    view: 'scan',
    alt: 'Terrain of the Loess Plateau with a satellite retrieving evapotranspiration pixel by pixel and a neural network above the map; in motion, the network takes in the map and its forecast runs down the rivers',
    readout: ['Satellite retrieval, AI model and forecast over the Loess Plateau', '黄土高原上空的卫星遥感、人工智能与预报'],
    steps: [['Satellite', '卫星遥感'], ['AI model', '人工智能'], ['Forecast', '预报']],
    caption: [
      'Loess Plateau and the Yellow River: mean evapotranspiration for 2001–2020 from our PML-V2.2 product on 0.1° cells, light to dark blue for 100 to 700 mm per year. The network’s inputs take the colour of the cells beneath them. The satellite pass, the neural network and the forecast on the rivers illustrate how remote sensing and AI are combined with physical models; they are not a model run.',
      '黄土高原与黄河：本组 PML-V2.2 产品 2001–2020 年平均蒸散发（0.1° 网格），由浅至深蓝表示 100–700 毫米/年。神经网络输入节点的颜色取自其下方网格的数值。卫星过境、神经网络与河网上的预报仅示意遥感、人工智能与物理模型的结合方式，并非模型运行结果。',
    ],
  },
};

export function themeView(themeId, { cls = '', readout = true, caption = false, lazy = true } = {}) {
  const v = THEME_VIEWS[themeId];
  if (!v) return '';
  return html`<figure class="tv ${cls}" data-module="theme" data-view="${v.view}">
    <div class="tv__stage">
      <img class="tv__still" src="/earth/theme-${v.view}-still.webp" width="960" height="640" alt="${v.alt}" ${lazy ? raw('loading="lazy"') : ''} decoding="async">
      <canvas class="tv__canvas" aria-hidden="true"></canvas>
      ${v.steps ? raw('<canvas class="tv__overlay" aria-hidden="true"></canvas>') : ''}
      ${v.steps ? html`<ol class="tv__steps">${v.steps.map(([en, zh]) => html`<li data-step>${t(en, zh)}</li>`)}</ol>` : ''}
      ${pauseButton()}
    </div>
    ${readout ? html`<p class="tv__readout" data-readout>${t(...v.readout)}</p>` : ''}
    ${caption ? html`<figcaption class="caption">${t(...v.caption)}</figcaption>` : ''}
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

/** Authors as written, with the principal investigator in bold and other members marked. */
export function groupAuthors(p, ctx) {
  const pi = ctx.api.site['site.pi']?.person_id;
  const list = ctx.sch.authors(p);
  const last = list.length - 1;
  const amp = /&/.test(p.authors);
  return list.map((a, i) => {
    const sep = i === 0 ? '' : i === last && amp ? ', & ' : ', ';
    const name = a.member === pi ? html`<b>${a.raw}</b>` : a.member ? html`<span class="au-m">${a.raw}</span>` : a.raw;
    return html`${sep}${name}`;
  });
}

/** Impact factor on a logarithmic meter: 2 fills a sixth, 70 fills it. */
const ifShare = (jif) => Math.min(1, Math.max(0.06, Math.log10(jif) / Math.log10(75))).toFixed(2);

/** The graphical labels for a paper's journal: impact factor and CAS quartile. */
export function journalMetrics(ctx, venue) {
  const m = ctx.sch.metrics(venue);
  if (!m) return '';
  return html`${m.jif
    ? html`<span class="jm jm--if" style="--f:${ifShare(m.jif)}"><span class="jm__k">IF</span><span class="jm__v">${m.jif.toFixed(1)}</span><span class="jm__meter" aria-hidden="true"></span><span class="sr-only">${t('Journal impact factor 2025', '2025 年度期刊影响因子')}</span></span>`
    : ''}${m.cas
    ? html`<span class="jm jm--cas jm--q${m.cas}"><span class="jm__bars" aria-hidden="true">${[1, 2, 3, 4].map((n) => html`<i class="${n <= 5 - m.cas ? 'on' : ''}"></i>`)}</span><span class="jm__v">${t(`CAS Q${m.cas}`, `中科院${m.cas}区`)}</span>${m.top ? html`<span class="jm__top">Top</span>` : ''}<span class="sr-only">${t(`, ${m.cas_field_en}, CAS journal ranking 2025`, `，${m.cas_field_zh}，中科院分区 2025 年升级版`)}</span></span>`
    : ''}${m.note_en ? html`<span class="jm jm--note">${t(m.note_en, m.note_zh)}</span>` : ''}`;
}

export function pubItem(p, ctx, { compact = false } = {}) {
  const location = [p.volume && `${p.volume}${p.issue ? `(${p.issue})` : ''}`, p.pages].filter(Boolean).join(', ');
  const link = pubLink(p);
  const search = `${p.title} ${p.authors} ${p.venue} ${p.year} ${p.doi}`.toLowerCase();
  const pdf = p.pdf_id ? ctx.files[p.pdf_id] : null;
  const flagship = ctx.sch.isFlagship(p);
  const m = ctx.sch.metrics(p.venue);
  return html`<li class="pub ${flagship ? 'pub--flag' : ''}" data-year="${p.year}" data-topics="${p.topics.join('|')}" data-search="${search}" data-flag="${flagship ? 1 : 0}" data-q1="${m?.cas === 1 ? 1 : 0}">
    <div class="pub__journal">
      <cite class="jname">${p.venue || 'Preprint'}</cite>
      <span class="jm-row">${journalMetrics(ctx, p.venue)}</span>
    </div>
    <h3 class="pub__title">${link ? html`<a href="${safeHref(link)}" target="_blank" rel="noopener">${p.title}</a>` : p.title}</h3>
    <p class="pub__authors">${groupAuthors(p, ctx)}</p>
    <p class="pub__venue">${p.year}${location ? `, ${location}` : ''}</p>
    ${compact
      ? ''
      : html`<p class="pub__actions">
      ${p.doi ? html`<a class="link" href="https://doi.org/${p.doi}" target="_blank" rel="noopener">DOI: ${p.doi}</a>` : ''}
      ${pdf ? html`<a class="link" href="${pdf.src}" target="_blank" rel="noopener">PDF</a>` : ''}
      <button class="link" type="button" data-copy="${apaCitation(p)}">${t('Copy citation', '复制引用')}</button>
    </p>`}
  </li>`;
}
