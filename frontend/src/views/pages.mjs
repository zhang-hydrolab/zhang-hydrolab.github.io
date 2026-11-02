import worldDots from '../data/world-dots.json' with { type: 'json' };
import { html, raw, safeHref, t } from '../lib/html.mjs';
import { renderMarkdown } from '../lib/markdown.mjs';
import { coverage, yearBars } from './charts.mjs';
import { categoryLabel, newsHref } from './home.mjs';
import { layout } from './layout.mjs';
import { arrow, button, external, pictogram, picture, pubItem } from './parts.mjs';

const pageHead = ({ tone, index, en, zh, lead, extra = '', cls = '' }) =>
  html`<section class="pagehead plane plane--${tone} ${cls}">
    ${extra}
    <div class="wrap pagehead__inner">
      <p class="eyebrow"><span class="eyebrow__i">/${index}</span>${t(en, zh)}</p>
      <h1 class="pagehead__title" data-reveal>${t(en, zh)}</h1>
      ${lead ? html`<p class="pagehead__lead">${lead}</p>` : ''}
    </div>
  </section>`;

/* ---------- Research ---------- */

export function researchPage(ctx) {
  const { themes } = ctx.api.research;
  const body = html`
    ${pageHead({
      tone: 'blue',
      index: 'R',
      en: 'Research',
      zh: '研究方向',
      lead: t('From a single 500-metre pixel to the whole planet: three connected programmes on how water moves, fails and can be forecast.', '从单个 500 米像元到整个地球：三个相互关联的研究方向，探索水如何运动、如何致灾，又如何被预测。'),
      extra: html`<canvas class="pagehead__field" data-module="isolines" aria-hidden="true"></canvas>`,
    })}
    <nav class="jump" aria-label="Research themes"><div class="wrap jump__inner">
      ${themes.map((theme, i) => html`<a href="#${theme.id}"><span>0${i + 1}</span>${t(theme.title_en, theme.title_zh)}</a>`)}
    </div></nav>
    ${themes.map(
      (theme, i) => html`<section class="theme theme--${theme.accent}" id="${theme.id}">
        <div class="theme__rail">
          <div class="theme__sticky">
            <span class="theme__i">0${i + 1}</span>
            ${pictogram[theme.id] ?? ''}
            <h2>${t(theme.title_en, theme.title_zh)}</h2>
          </div>
        </div>
        <div class="theme__main">
          <p class="theme__lead" data-reveal>${t(theme.summary_en, theme.summary_zh)}</p>
          ${theme.projects.map(
            (p) => html`<article class="project" data-reveal>
              <h3>${p.name}</h3>
              ${p.image_id
                ? html`<button class="project__fig" type="button" data-zoom data-cursor="Zoom" aria-label="Enlarge figure for ${p.name}">
                    ${picture(ctx, p.image_id, { sizes: '(max-width: 900px) 100vw, 60vw', alt: `${p.name} figure` })}
                  </button>`
                : ''}
              <p>${p.description}</p>
              ${p.related.length
                ? html`<details class="refs">
                    <summary>${t(`Related publications (${p.related.length})`, `相关论文（${p.related.length}）`)}</summary>
                    <ol>${p.related.map((r) => html`<li>${linkify(r)}</li>`)}</ol>
                  </details>`
                : ''}
            </article>`,
          )}
        </div>
      </section>`,
    )}`;
  return layout(ctx, { page: 'research', title: 'Research', description: 'Research themes of the Large Scale Hydrology group: the changing water cycle, water-related disasters, and new technologies for hydrology.', nav: 'dark', body, path: '/research.html' });
}

function linkify(text) {
  const parts = text.split(/(https?:\/\/\S+)/);
  return parts.map((part) => {
    if (!/^https?:\/\//.test(part)) return part;
    const clean = part.replace(/[.,;]+$/, '');
    return html`<a class="link" href="${safeHref(clean)}" target="_blank" rel="noopener">${clean.replace(/^https?:\/\/(dx\.)?/, '')}</a>${part.slice(clean.length)}`;
  });
}

/* ---------- Publications ---------- */

export function publicationsPage(ctx) {
  const { publications } = ctx.api;
  const years = [...new Set(publications.items.map((p) => p.year))].sort((a, b) => b - a);
  const body = html`
    <section class="pagehead plane plane--paper pagehead--pubs">
      <div class="wrap pubs-head">
        <div>
          <p class="eyebrow"><span class="eyebrow__i">/P</span>${t('Publications', '论文成果')}</p>
          <h1 class="pagehead__title" data-reveal>${t('In print', '已发表')}</h1>
          <p class="pagehead__lead">${t(`${publications.count} selected papers. Search them, or filter by topic and year.`, `收录 ${publications.count} 篇代表性论文，可按主题和年份筛选。`)}</p>
          <p class="note"><a class="link" href="${ctx.api.site['site.contact'].links[0].url}" target="_blank" rel="noopener">${t('Full record on Google Scholar', '完整列表见 Google Scholar')}</a></p>
        </div>
        ${yearBars(ctx, { buttons: true })}
      </div>
    </section>
    <section class="plane plane--paper" data-module="pubfilter">
      <div class="filterbar">
        <div class="wrap filterbar__inner">
          <label class="field"><span class="sr-only">Search publications</span>
            <input type="search" data-filter-q placeholder="Search title, author, journal, DOI" autocomplete="off">
            <kbd>/</kbd>
          </label>
          <div class="chips" role="group" aria-label="Filter by topic">
            <button type="button" class="chip is-on" data-filter-topic="" aria-pressed="true">${t('All topics', '全部主题')}</button>
            ${publications.topics.map((x) => html`<button type="button" class="chip" data-filter-topic="${x.topic}" aria-pressed="false">${x.topic} <span>${x.count}</span></button>`)}
          </div>
          <p class="filterbar__count" data-filter-count aria-live="polite"></p>
        </div>
      </div>
      <div class="wrap">
        ${years.map(
          (year) => html`<section class="year" data-year-group="${year}">
            <h2 class="year__n">${year}</h2>
            <ul class="pubs">${publications.items.filter((p) => p.year === year).map((p) => pubItem(p, ctx))}</ul>
          </section>`,
        )}
        <p class="empty" data-filter-empty hidden>${t('Nothing matches. Try fewer filters.', '没有匹配结果，请减少筛选条件。')}</p>
      </div>
    </section>`;
  return layout(ctx, { page: 'publications', title: 'Publications', description: 'Searchable list of publications from the Large Scale Hydrology group.', nav: 'light', body, path: '/publications.html' });
}

/* ---------- Data ---------- */

export function dataPage(ctx) {
  const { items } = ctx.api.datasets;
  const body = html`
    ${pageHead({
      tone: 'ink',
      index: 'D',
      en: 'Open data',
      zh: '开放数据',
      lead: t('Gridded evapotranspiration, productivity and water-storage products, free to download. Every pixel below stands for how we see the land: one cell at a time.', '免费开放的蒸散发、生产力和水储量格点数据产品。下方每个像元，都代表我们观察陆地的方式：一格一格地看。'),
      extra: html`<canvas class="pagehead__field" data-module="mosaic" aria-hidden="true"></canvas>`,
      cls: 'pagehead--data',
    })}
    <section class="plane plane--blue data-cov">
      <div class="wrap">
        <h2 class="scale__title">${t('Temporal coverage', '时间覆盖')}</h2>
        ${coverage(ctx, { detail: false })}
      </div>
    </section>
    <section class="plane plane--paper">
      <div class="wrap sheets">
        ${items.map(
          (d, i) => html`<article class="sheet" id="${d.id}">
            <header class="sheet__head">
              <span class="sheet__i">0${i + 1}</span>
              <h2>${d.name}</h2>
              <p>${t(d.summary_en, d.summary_zh)}</p>
            </header>
            <dl class="spec spec--grid">
              <div><dt>${t('Scope', '范围')}</dt><dd>${d.scope}</dd></div>
              <div><dt>${t('Variables', '变量')}</dt><dd>${d.variables}</dd></div>
              <div><dt>${t('Time step', '时间分辨率')}</dt><dd>${d.temporal}</dd></div>
              <div><dt>${t('Grid', '空间分辨率')}</dt><dd>${d.spatial}</dd></div>
              <div><dt>${t('Coverage', '时间范围')}</dt><dd>${d.coverage_label}</dd></div>
            </dl>
            <div class="sheet__body">
              <div>
                <h3>${t('Download', '下载')}</h3>
                <ul class="dl">${d.downloads.map((link) => html`<li><a href="${safeHref(link.url)}" target="_blank" rel="noopener" data-magnetic>${link.label} ${external}</a></li>`)}</ul>
                <h3>${t('How to cite', '引用方式')}</h3>
                <ol class="cite">${d.citations.map((c) => html`<li><p>${c}</p><button class="link" type="button" data-copy="${c}">${t('Copy', '复制')}</button></li>`)}</ol>
              </div>
              ${d.image_id
                ? html`<button class="project__fig" type="button" data-zoom data-cursor="Zoom" aria-label="Enlarge figure for ${d.name}">${picture(ctx, d.image_id, { sizes: '(max-width: 900px) 100vw, 44vw', alt: `${d.name} figure` })}</button>`
                : ''}
            </div>
          </article>`,
        )}
      </div>
    </section>`;
  return layout(ctx, { page: 'data', title: 'Data', description: 'Open global and regional evapotranspiration, GPP and terrestrial water storage datasets: PML_v2, PML_v2.2, PML_v2-China and GRACE-Transformer-Gap.', nav: 'dark', body, path: '/data.html' });
}

/* ---------- People ---------- */

function personTile(ctx, person) {
  const name = [person.honorific, person.name_en].filter(Boolean).join(' ');
  const search = `${person.name_en} ${person.name_zh} ${person.research_field}`.toLowerCase();
  return html`<li class="person" data-search="${search}" id="p-${person.id}">
    <button class="person__btn" type="button" data-person aria-haspopup="dialog">
      <span class="person__media">${picture(ctx, person.photo_id, { cls: 'duotone', sizes: '(max-width: 640px) 46vw, (max-width: 1100px) 30vw, 19vw', alt: '', style: `object-position:${person.photo_focus}` })}</span>
      <span class="person__name">${person.name_en}${person.name_zh ? html`<span lang="zh-CN">${person.name_zh}</span>` : ''}</span>
      <span class="person__field">${person.research_field}</span>
    </button>
    <div class="person__detail">
      ${picture(ctx, person.photo_id, { sizes: '320px', alt: `Portrait of ${name}`, style: `object-position:${person.photo_focus}` })}
      <div>
        <h3>${name}${person.name_zh ? html` <span lang="zh-CN">${person.name_zh}</span>` : ''}</h3>
        <p class="person__role">${person.research_field}</p>
        ${person.bio_en ? html`<p>${person.bio_en}</p>` : ''}
        <ul class="person__links">
          ${person.email ? html`<li><a class="link" href="mailto:${person.email}">${person.email}</a></li>` : ''}
          ${person.links.map((link) => html`<li><a class="link" href="${safeHref(link.url)}" target="_blank" rel="noopener">${link.label}</a></li>`)}
        </ul>
      </div>
    </div>
  </li>`;
}

export function peoplePage(ctx) {
  const { people, site, meta } = ctx.api;
  const piSetting = site['site.pi'];
  const pi = people.groups.find((g) => g.key === 'pi')?.members[0];
  const groups = people.groups.filter((g) => g.key !== 'pi');
  const stats = site['site.stats'];
  const para = (list, lang) => list.map((p) => html`<p class="${lang === 'zh' ? 't-zh' : 't-en'}" ${lang === 'zh' ? raw('lang="zh-CN"') : ''}>${p}</p>`);
  const assets = site['site.assets'];

  const body = html`
    ${pageHead({
      tone: 'ink',
      index: 'T',
      en: 'People',
      zh: '团队成员',
      lead: t(`${meta.counts.people} researchers and students, and ${meta.counts.alumni} alumni now working around the world.`, `${meta.counts.people} 位科研人员与学生，以及 ${meta.counts.alumni} 位已走向世界各地的校友。`),
      extra: picture(ctx, assets.group_photo_alt, { cls: 'pagehead__photo duotone', sizes: '100vw', eager: true, alt: '' }),
      cls: 'pagehead--people',
    })}
    ${pi
      ? html`<section class="pi plane plane--paper" id="pi">
          <div class="wrap pi__grid">
            <div class="pi__side">
              ${picture(ctx, pi.photo_id, { cls: 'pi__photo', sizes: '(max-width: 900px) 100vw, 32vw', alt: 'Portrait of Prof. Yongqiang Zhang', style: 'object-position:50% 20%' })}
              <ul class="pi__stats">${stats.map((s) => html`<li><b>${s.value.toLocaleString('en-US')}${s.suffix}</b><span>${t(s.label_en, s.label_zh)}</span></li>`)}</ul>
            </div>
            <div class="pi__text">
              <p class="eyebrow">${t('Principal Investigator', '团队负责人')}</p>
              <h2 class="title"><span class="t-en">${pi.honorific} ${pi.name_en}</span><span class="t-zh" lang="zh-CN">${pi.name_zh}</span></h2>
              <p class="pi__role">${t(piSetting.title_en, piSetting.title_zh)}</p>
              ${para(piSetting.bio_en, 'en')}
              ${para(piSetting.bio_zh, 'zh')}
              <ul class="person__links">
                <li><a class="link" href="mailto:${pi.email}">${pi.email}</a></li>
                ${pi.links.map((link) => html`<li><a class="link" href="${safeHref(link.url)}" target="_blank" rel="noopener">${link.label}</a></li>`)}
              </ul>
            </div>
          </div>
        </section>`
      : ''}
    <section class="plane plane--paper" data-module="peoplefilter">
      <div class="filterbar">
        <div class="wrap filterbar__inner">
          <label class="field"><span class="sr-only">Search people</span><input type="search" data-people-q placeholder="Search name or research field" autocomplete="off"></label>
          <div class="chips" role="group" aria-label="Filter by role">
            <button type="button" class="chip is-on" data-people-role="" aria-pressed="true">${t('Everyone', '全部')}</button>
            ${groups.map((g) => html`<button type="button" class="chip" data-people-role="${g.key}" aria-pressed="false">${t(g.label.en, g.label.zh)} <span>${g.members.length}</span></button>`)}
          </div>
        </div>
      </div>
      <div class="wrap">
        ${groups.map(
          (g) => html`<section class="group" data-group="${g.key}" id="${g.key}">
            <h2 class="group__title">${t(g.label.en, g.label.zh)}<span>${g.members.length}</span></h2>
            <ul class="people-grid${g.key === 'alumni' ? ' people-grid--alumni' : ''}">${g.members.map((m) => personTile(ctx, m))}</ul>
          </section>`,
        )}
      </div>
    </section>
    <dialog class="sheet-dialog" data-person-dialog aria-label="Person details">
      <button class="nav__tool sheet-dialog__close" type="button" data-dialog-close aria-label="Close"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m4 4 12 12M16 4 4 16" stroke="currentColor" stroke-width="1.8"/></svg></button>
      <div data-person-slot></div>
    </dialog>`;
  return layout(ctx, { page: 'people', title: 'People', description: 'Members and alumni of the Large Scale Hydrology group led by Prof. Yongqiang Zhang (张永强) at IGSNRR, Chinese Academy of Sciences.', nav: 'dark', body, path: '/people.html' });
}

/* ---------- News ---------- */

export function newsPage(ctx) {
  const { items } = ctx.api.news;
  const years = [...new Set(items.map((n) => n.year))].sort((a, b) => b - a);
  const [lead, ...rest] = items;
  const body = html`
    ${pageHead({ tone: 'lime', index: 'N', en: 'News', zh: '新闻动态', lead: t('Papers, honours and group life, as they happen.', '论文发表、学术荣誉与团队日常。') })}
    ${lead
      ? html`<section class="plane plane--ink newslead">
          <a class="wrap newslead__grid" href="${safeHref(newsHref(lead))}" ${lead.body_md ? '' : raw('target="_blank" rel="noopener"')}>
            <div>
              <p class="eyebrow">${categoryLabel(lead.category)} · ${lead.year}</p>
              <h2 class="newslead__title">${t(lead.title_en, lead.title_zh)}</h2>
              ${lead.summary_en || lead.summary_zh ? html`<p>${t(lead.summary_en, lead.summary_zh)}</p>` : ''}
            </div>
            ${picture(ctx, lead.cover_id, { cls: 'newslead__img', sizes: '(max-width: 900px) 100vw, 40vw', eager: true, alt: '' })}
          </a>
        </section>`
      : ''}
    <section class="plane plane--paper" data-module="newslist">
      <div class="wrap">
        <div class="chips newsfilter" role="group" aria-label="Filter by year">
          <button type="button" class="chip is-on" data-news-year="" aria-pressed="true">${t('All years', '全部年份')}</button>
          ${years.map((y) => html`<button type="button" class="chip" data-news-year="${y}" aria-pressed="false">${y}</button>`)}
        </div>
        <ul class="newsrows">
          ${rest.map((n) => {
            const image = ctx.images[n.cover_id];
            return html`<li data-year="${n.year}">
              <a href="${safeHref(newsHref(n))}" ${n.body_md ? '' : raw('target="_blank" rel="noopener"')} data-preview="${image?.thumb ?? ''}">
                <span class="newsrows__year">${n.year}</span>
                <span class="newsrows__cat">${categoryLabel(n.category)}</span>
                <span class="newsrows__title">${t(n.title_en, n.title_zh)}</span>
                ${n.body_md ? arrow : external}
              </a>
            </li>`;
          })}
        </ul>
      </div>
      <img class="newsprev" data-news-preview alt="" hidden>
    </section>`;
  return layout(ctx, { page: 'news', title: 'News', description: 'News from the Large Scale Hydrology group.', nav: 'light', body, path: '/news.html' });
}

export function articlePage(ctx, n) {
  const figure = (id, alt) => html`<figure>${picture(ctx, id, { sizes: '(max-width: 900px) 100vw, 760px', alt })}</figure>`;
  const body = html`
    <article class="article plane plane--paper">
      <header class="wrap article__head">
        <p class="eyebrow">${categoryLabel(n.category)} · ${n.date || n.year}</p>
        <h1>${t(n.title_en, n.title_zh)}</h1>
        ${n.summary_en || n.summary_zh ? html`<p class="pagehead__lead">${t(n.summary_en, n.summary_zh)}</p>` : ''}
      </header>
      ${n.cover_id ? html`<div class="wrap article__cover"><button class="project__fig" type="button" data-zoom data-cursor="Zoom" aria-label="Enlarge image">${picture(ctx, n.cover_id, { sizes: '(max-width: 1100px) 100vw, 1000px', eager: true })}</button></div>` : ''}
      <div class="wrap article__body" lang="zh-CN">${renderMarkdown(n.body_md, figure)}</div>
      <footer class="wrap article__foot">
        ${n.source_url ? button(n.source_url, 'Original article', '阅读原文', { out: true }) : ''}
        ${button('/news.html', 'All news', '全部新闻', { cls: 'btn--quiet' })}
      </footer>
    </article>`;
  return layout(ctx, { page: 'news', title: n.title_en || n.title_zh, description: n.summary_en || n.summary_zh || n.title_en || n.title_zh, nav: 'light', body, path: `/news/${encodeURIComponent(n.id)}.html`, image: ctx.images[n.cover_id]?.src });
}

/* ---------- Collaboration ---------- */

const WIDTH = 1000;
const project = (lon, lat, height, [south, north]) => [((lon + 180) / 360) * WIDTH, ((north - lat) / (north - south)) * height];

function worldMap(ctx) {
  const items = ctx.api.collaborators.items;
  const { latRange, dots, step } = worldDots;
  const height = Math.round((WIDTH * (latRange[1] - latRange[0])) / 360);
  const land = dots.map(([lon, lat]) => {
    const [x, y] = project(lon, lat, height, latRange);
    return `M${x.toFixed(1)} ${y.toFixed(1)}h0`;
  });
  const home = project(116.39, 39.99, height, latRange);

  const places = new Map();
  for (const c of items) {
    if (c.lat == null || c.lon == null) continue;
    const key = `${c.lat},${c.lon}`;
    if (!places.has(key)) places.set(key, { city: c.city, lat: c.lat, lon: c.lon, ids: [] });
    places.get(key).ids.push(c.id);
  }

  const points = [...places.values()].map((place) => ({ place, xy: project(place.lon, place.lat, height, latRange) }));

  // Cities close together would stack their labels, so the group fans out:
  // the western one labels to the left, the eastern one below, any between above.
  const near = WIDTH * 0.06;
  const labelFor = ([x, y]) => {
    const others = points.map((p) => p.xy).filter(([ox, oy]) => (ox !== x || oy !== y) && Math.abs(ox - x) < near && Math.abs(oy - y) < near);
    const east = others.some(([ox]) => ox > x);
    const west = others.some(([ox]) => ox < x);
    if (east && !west) return { x: x - 9, y: y + 4, anchor: 'end' };
    if (west && !east) return { x: x + 6, y: y + 19, anchor: 'start' };
    return { x, y: y - 11, anchor: 'middle' };
  };

  return html`<svg class="worldmap" viewBox="0 0 ${WIDTH} ${height}" role="img" aria-label="World map showing collaborating institutions linked to Beijing">
    <path class="worldmap__land" d="${land.join('')}" style="stroke-width:${((step / 360) * WIDTH * 0.62).toFixed(2)}px"/>
    ${points.map(({ place, xy }, i) => {
      const [x, y] = xy;
      const mx = (x + home[0]) / 2;
      const my = Math.min(y, home[1]) - Math.abs(x - home[0]) * 0.16;
      const label = labelFor(xy);
      return html`<g class="worldmap__place" data-place="${place.ids.join(' ')}" style="--i:${i}">
        <path class="worldmap__arc" d="M${home[0].toFixed(1)} ${home[1].toFixed(1)}Q${mx.toFixed(1)} ${my.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)}" pathLength="1"/>
        <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4.5"/>
        <text x="${label.x.toFixed(1)}" y="${label.y.toFixed(1)}" text-anchor="${label.anchor}">${place.city}</text>
      </g>`;
    })}
    <g class="worldmap__home"><circle cx="${home[0].toFixed(1)}" cy="${home[1].toFixed(1)}" r="6"/><text x="${home[0].toFixed(1)}" y="${(home[1] + 20).toFixed(1)}" text-anchor="middle">Beijing</text></g>
  </svg>`;
}

export function collaborationPage(ctx) {
  const { items } = ctx.api.collaborators;
  const body = html`
    <section class="pagehead plane plane--ink pagehead--map">
      <div class="wrap">
        <p class="eyebrow"><span class="eyebrow__i">/C</span>${t('Collaboration', '合作网络')}</p>
        <h1 class="pagehead__title" data-reveal>${t('Water has no borders', '水无国界')}</h1>
        <p class="pagehead__lead">${t('We work with leading hydrologists and climate scientists across Europe, North America and Australia.', '我们与欧洲、北美和澳大利亚的顶尖水文与气候科学家长期合作。')}</p>
      </div>
      <div class="wrap" data-module="worldmap">${worldMap(ctx)}</div>
    </section>
    <section class="plane plane--paper">
      <ul class="wrap collabs">
        ${items.map(
          (c) => html`<li class="collab" id="${c.id}" data-collab="${c.id}">
            ${picture(ctx, c.photo_id, { cls: 'duotone', sizes: '(max-width: 640px) 40vw, 180px', alt: `Portrait of ${c.name}`, style: 'object-position:50% 20%' })}
            <div>
              <h2>${c.name}</h2>
              <p class="collab__org">${c.institute}${c.city ? ` · ${c.city}` : ''}</p>
              <p>${c.bio}</p>
            </div>
          </li>`,
        )}
      </ul>
    </section>`;
  return layout(ctx, { page: 'collaboration', title: 'Collaboration', description: 'International collaborators of the Large Scale Hydrology group.', nav: 'dark', body, path: '/collaboration.html' });
}

/* ---------- 404 ---------- */

export function notFoundPage(ctx) {
  const body = html`<section class="lost plane plane--blue">
    <canvas class="hero__field" data-module="isolines" aria-hidden="true"></canvas>
    <div class="wrap lost__inner">
      <p class="eyebrow">404</p>
      <h1 class="pagehead__title">${t('This river has no outlet.', '这条河没有出口。')}</h1>
      <p class="pagehead__lead">${t('The page you were following dried up. Head back downstream.', '您寻找的页面已经干涸，请返回下游。')}</p>
      ${button('/', 'Back to the homepage', '返回首页', { cls: 'btn--lime' })}
    </div>
  </section>`;
  return layout(ctx, { page: '404', title: 'Page not found', description: 'Page not found.', nav: 'dark', body, path: '/404.html' });
}
