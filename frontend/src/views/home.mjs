import { html, raw, safeHref, t } from '../lib/html.mjs';
import { budgetSection, coverage, yearBars } from './charts.mjs';
import { layout } from './layout.mjs';
import { arrow, button, external, eyebrow, pictogram, picture, pubItem } from './parts.mjs';

export const newsHref = (n) => (n.body_md ? `/news/${encodeURIComponent(n.id)}.html` : n.source_url || '/news.html');
const CATEGORY = {
  news: ['News', '新闻'],
  publication: ['Paper', '论文'],
  award: ['Honour', '荣誉'],
  event: ['Event', '活动'],
};
export const categoryLabel = (key) => t(...(CATEGORY[key] ?? CATEGORY.news));

function hero(ctx) {
  const { site, news } = ctx.api;
  const lab = site['site.lab'];
  const latest = news.items[0];
  return html`<section class="hero">
    <canvas class="hero__field" data-module="isolines" aria-hidden="true"></canvas>
    <div class="hero__inner">
      <h1 class="hero__title" data-module="herotype">
        <span class="t-en"><span class="hl">Large</span><span class="hl">Scale</span><span class="hl hl--wide">Hydrology</span></span>
        <span class="t-zh" lang="zh-CN"><span class="hl">大尺度</span><span class="hl">水文学</span></span>
      </h1>
      <div class="hero__aside">
        <p class="hero__tag">${t(lab.tagline_en, lab.tagline_zh)}</p>
        <div class="hero__cta">
          ${button('/research.html', 'Our research', '研究方向', { cls: 'btn--lime' })}
          ${button('/data.html', 'Open data', '开放数据', { cls: 'btn--ghost' })}
        </div>
        <dl class="hero__spec">
          <div><dt>${t('Institute', '依托单位')}</dt><dd>${lab.institute_short}</dd></div>
          <div><dt>${t('Station', '位置')}</dt><dd>39.99°N 116.39°E</dd></div>
          <div class="hero__hint"><dt>${t('Field', '交互')}</dt><dd>${t('Move across the water. Click to drop rain.', '在水面上移动，点击落下雨滴。')}</dd></div>
        </dl>
      </div>
    </div>
    ${latest
      ? html`<a class="hero__ticker" href="${safeHref(newsHref(latest))}" ${latest.body_md ? '' : raw('target="_blank" rel="noopener"')}>
          <span class="hero__ticker-tag">${t('Latest', '最新')}</span>
          <span class="hero__ticker-text">${t(latest.title_en, latest.title_zh)}</span>
          ${arrow}
        </a>`
      : ''}
  </section>`;
}

function marquee(items, cls = '') {
  const row = html`${items.map((item) => html`<span>${item}</span><i aria-hidden="true"></i>`)}`;
  return html`<div class="marquee ${cls}" data-marquee aria-hidden="true"><div class="marquee__track">${row}${row}${row}${row}</div></div>`;
}

function statement(ctx, index) {
  const { site } = ctx.api;
  const lab = site['site.lab'];
  const stats = site['site.stats'];
  const tones = ['paper-2', 'ink', 'blue', 'lime'];
  return html`<section class="statement plane plane--paper">
    <div class="wrap">
      ${eyebrow(index, 'What we do', '我们做什么')}
      <p class="statement__text" data-module="scrollwords">${t(lab.statement_en, lab.statement_zh)}</p>
    </div>
    <ul class="tiles">
      ${stats.map(
        (s, i) => html`<li class="tile-stat tile-stat--${tones[i % tones.length]}" data-reveal>
          <span class="tile-stat__n" data-count="${s.value}" data-suffix="${s.suffix}">${s.value.toLocaleString('en-US')}${s.suffix}</span>
          <span class="tile-stat__l">${t(s.label_en, s.label_zh)}</span>
        </li>`,
      )}
    </ul>
  </section>`;
}

function themes(ctx, index) {
  const { themes: items } = ctx.api.research;
  return html`<section class="themes plane plane--paper">
    <div class="wrap">
      <div class="sec-head">
        <div>
          ${eyebrow(index, 'Research', '研究方向')}
          <h2 class="title" data-reveal>${t('Three currents,', '三条主线，')}<br>${html`<span class="dim">${t('one water cycle.', '一个水循环。')}</span>`}</h2>
        </div>
        ${button('/research.html', 'All research', '全部研究')}
      </div>
    </div>
    <div class="panels" data-module="panels">
      ${items.map(
        (theme, i) => html`<article class="panel panel--${theme.accent}${i === 0 ? ' is-open' : ''}" tabindex="0">
          <div class="panel__head">
            <span class="panel__i">0${i + 1}</span>
            ${pictogram[theme.id] ?? ''}
          </div>
          <div class="panel__body">
            <h3>${t(theme.title_en, theme.title_zh)}</h3>
            <div class="panel__more">
              <div>
                <p>${t(theme.summary_en, theme.summary_zh)}</p>
                <ul class="chips chips--static">${theme.projects.map((p) => html`<li>${p.name}</li>`)}</ul>
                <a class="link" href="/research.html#${theme.id}">${t('Read more', '了解更多')} ${arrow}</a>
              </div>
            </div>
          </div>
        </article>`,
      )}
    </div>
  </section>`;
}

function highlights(ctx, index) {
  const items = ctx.api.news.items.filter((n) => n.featured);
  return html`<section class="highlights plane plane--paper">
    <div class="wrap sec-head">
      <div>
        ${eyebrow(index, 'Highlights', '研究亮点')}
        <h2 class="title" data-reveal>${t('Recent', '近期')} ${html`<span class="dim">${t('currents.', '动态。')}</span>`}</h2>
      </div>
      ${button('/news.html', 'All news', '全部新闻')}
    </div>
    <ul class="strip" data-module="dragscroll" tabindex="0" aria-label="Highlights, scrollable">
      ${items.map(
        (n) => html`<li class="card">
          <a href="${safeHref(newsHref(n))}" ${n.body_md ? '' : raw('target="_blank" rel="noopener"')} data-cursor="Read">
            <span class="card__media">${picture(ctx, n.cover_id, { sizes: '(max-width: 720px) 82vw, 34vw', alt: '' })}</span>
            <span class="card__meta"><span>${categoryLabel(n.category)}</span><span>${n.year}</span></span>
            <span class="card__title">${t(n.title_en, n.title_zh)}</span>
          </a>
        </li>`,
      )}
    </ul>
  </section>`;
}

function data(ctx, index) {
  return html`<section class="data-band plane plane--blue">
    <div class="wrap">
      <div class="sec-head">
        <div>
          ${eyebrow(index, 'Open data', '开放数据')}
          <h2 class="title" data-reveal>${t('Four decades', '四十余年')}<br>${html`<span class="dim">${t('of the land surface.', '的陆面观测。')}</span>`}</h2>
        </div>
        ${button('/data.html', 'All datasets', '全部数据', { cls: 'btn--lime' })}
      </div>
      ${coverage(ctx)}
    </div>
  </section>`;
}

function papers(ctx, index) {
  const latest = ctx.api.publications.items.filter((p) => p.featured).slice(0, 3);
  return html`<section class="papers plane plane--paper">
    <div class="wrap">
      <div class="sec-head">
        <div>
          ${eyebrow(index, 'Publications', '论文成果')}
          <h2 class="title" data-reveal>${t('In print.', '已发表。')}</h2>
        </div>
        ${button('/publications.html', 'All publications', '全部论文')}
      </div>
      <div class="papers__grid">
        <div>
          ${yearBars(ctx)}
          <p class="note">${t('Selected publications listed on this site. Select a year to browse it.', '本站收录的代表性论文。选择年份即可浏览。')}</p>
        </div>
        <ul class="pubs pubs--compact">${latest.map((p) => pubItem(p, ctx))}</ul>
      </div>
    </div>
  </section>`;
}

function crew(ctx, index) {
  const { people, site, meta } = ctx.api;
  const assets = site['site.assets'];
  const active = people.groups.filter((g) => g.key !== 'alumni');
  const names = active.flatMap((g) => g.members.map((m) => m.name_en));
  const half = Math.ceil(names.length / 2);
  return html`<section class="crew plane plane--ink">
    <div class="crew__photo">
      ${picture(ctx, assets.group_photo, { cls: 'duotone', sizes: '100vw', alt: 'Group photo at the 2026 graduation ceremony' })}
    </div>
    ${marquee(names.slice(0, half), 'marquee--names')}
    ${marquee(names.slice(half), 'marquee--names marquee--rev')}
    <div class="wrap crew__foot">
      <div>
        ${eyebrow(index, 'People', '团队成员')}
        <h2 class="title" data-reveal>${t(`${meta.counts.people} people,`, `${meta.counts.people} 位成员，`)}<br>${html`<span class="dim">${t(`${meta.counts.alumni} alumni.`, `${meta.counts.alumni} 位校友。`)}</span>`}</h2>
      </div>
      <div class="crew__cta">
        <ul class="counts">${active.map((g) => html`<li><b>${g.members.length}</b><span>${t(g.label.en, g.label.zh)}</span></li>`)}</ul>
        ${button('/people.html', 'Meet the group', '认识我们', { cls: 'btn--lime' })}
      </div>
    </div>
  </section>`;
}

function join(ctx, index) {
  const r = ctx.api.site['site.recruitment'];
  const contact = ctx.api.site['site.contact'];
  const col = (en, zh, items) => html`<div><h3>${t(en, zh)}</h3><ul>${items.map((x) => html`<li>${t(x.en, x.zh)}</li>`)}</ul></div>`;
  return html`<section class="join plane plane--coral" id="join">
    <div class="wrap">
      ${eyebrow(index, 'Join us', '加入我们')}
      <h2 class="join__title" data-reveal>${t(r.title_en, r.title_zh)}</h2>
      <div class="join__grid">
        <p class="join__body">${t(r.body_en, r.body_zh)}</p>
        ${col('Openings', '招收', r.openings)}
        ${col('Topics', '方向', r.topics)}
        ${col('Love of', '技能', r.skills)}
      </div>
      <a class="join__mail" href="mailto:${contact.email}" data-magnetic>${contact.email} ${external}</a>
    </div>
  </section>`;
}

export function homePage(ctx) {
  const { site } = ctx.api;
  const lab = site['site.lab'];
  const body = html`
    ${hero(ctx)}
    ${marquee(site['site.journals'], 'marquee--journals')}
    ${statement(ctx, '01')}
    ${budgetSection(ctx, '02')}
    ${themes(ctx, '03')}
    ${highlights(ctx, '04')}
    ${data(ctx, '05')}
    ${papers(ctx, '06')}
    ${crew(ctx, '07')}
    ${join(ctx, '08')}`;
  return layout(ctx, { page: 'home', description: `${lab.name_en} group at ${lab.institute_en}. ${lab.tagline_en}`, nav: 'dark', body, path: '/' });
}
