import worldDots from '../data/world-dots.json' with { type: 'json' };
import { html, safeHref, t } from '../lib/html.mjs';
import { renderMarkdown } from '../lib/markdown.mjs';
import { coverage } from './charts.mjs';
import { categoryLabel, newsDate, newsHref, newsTarget } from './home.mjs';
import { layout } from './layout.mjs';
import { personLinks } from './person-links.mjs';
import { fig, more, paragraphs, pauseButton, picture, pubItem, terrainBlock } from './parts.mjs';

const pageHead = ({ en, zh, lead, scene }) =>
  html`<header class="pagehead">
    <div class="wrap pagehead__grid">
      <div>
        <p class="kicker"><a href="/">${t('Home', '首页')}</a> / ${t(en, zh)}</p>
        <h1>${t(en, zh)}</h1>
        ${lead ? html`<p class="pagehead__lead">${lead}</p>` : ''}
      </div>
      ${scene ? terrainBlock(scene) : ''}
    </div>
  </header>`;

/* ---------- Research ---------- */

export function researchPage(ctx) {
  const { themes } = ctx.api.research;
  const body = html`
    ${pageHead({
      scene: 'hengduan',
      en: 'Research',
      zh: '研究方向',
      lead: t('Three connected programmes: the changing water cycle, water-related disasters and security, and new methods for hydrology.', '三个相互关联的研究方向：变化环境下的水循环、水灾害与水安全，以及水文水资源新技术。'),
    })}
    <div class="wrap split">
      <nav class="toc" aria-label="Research themes">
        <h2>${t('Contents', '目录')}</h2>
        <ol>${themes.map((theme) => html`<li><a href="#${theme.id}">${t(theme.title_en, theme.title_zh)}</a></li>`)}</ol>
      </nav>
      <div class="split__main">
        ${themes.map(
          (theme) => html`<section class="theme" id="${theme.id}">
            <h2>${t(theme.title_en, theme.title_zh)}</h2>
            <p class="prose-lead">${t(theme.summary_en, theme.summary_zh)}</p>
            ${theme.projects.map(
              (p) => html`<article class="project">
                <h3>${p.name}</h3>
                <p>${p.description}</p>
                ${p.image_id ? fig(ctx, p.image_id, { alt: `${p.name} figure`, en: p.name }) : ''}
                ${p.related.length
                  ? html`<details class="refs">
                      <summary>${t(`Related publications (${p.related.length})`, `相关论文（${p.related.length}）`)}</summary>
                      <ol>${p.related.map((r) => html`<li>${linkify(r)}</li>`)}</ol>
                    </details>`
                  : ''}
              </article>`,
            )}
          </section>`,
        )}
      </div>
    </div>`;
  return layout(ctx, { page: 'research', title: 'Research', description: 'Research themes of the Large Scale Hydrology group: the changing water cycle, water-related disasters, and new technologies for hydrology.', body, path: '/research.html' });
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
  const scholar = ctx.api.site['site.contact'].links[0].url;
  const body = html`
    ${pageHead({
      scene: 'loess',
      en: 'Publications',
      zh: '论文成果',
      lead: html`${t(`${publications.count} selected papers. The full record is on`, `收录 ${publications.count} 篇代表性论文，完整列表见`)} <a class="link" href="${scholar}" target="_blank" rel="noopener">Google Scholar</a>.`,
    })}
    <section class="wrap" data-module="pubfilter">
      <div class="filters">
        <label class="field"><span class="sr-only">Search publications</span>
          <input type="search" data-filter-q placeholder="Search title, author, journal or DOI" data-placeholder-zh="搜索标题、作者、期刊或 DOI" autocomplete="off">
        </label>
        <div class="tags" role="group" aria-label="Filter by topic">
          <button type="button" class="tag is-on" data-filter-topic="" aria-pressed="true">${t('All topics', '全部主题')}</button>
          ${publications.topics.map((x) => html`<button type="button" class="tag" data-filter-topic="${x.topic}" aria-pressed="false">${x.topic} (${x.count})</button>`)}
        </div>
        <div class="tags" role="group" aria-label="Filter by year">
          ${years.map((y) => html`<button type="button" class="tag" data-filter-year="${y}" aria-pressed="false">${y}</button>`)}
        </div>
        <p class="meta" data-filter-count aria-live="polite"></p>
      </div>
      ${years.map(
        (year) => html`<section class="year" data-year-group="${year}">
          <h2>${year}</h2>
          <ul class="pubs">${publications.items.filter((p) => p.year === year).map((p) => pubItem(p, ctx))}</ul>
        </section>`,
      )}
      <p class="empty" data-filter-empty hidden>${t('No publications match these filters.', '没有符合筛选条件的论文。')}</p>
    </section>`;
  return layout(ctx, { page: 'publications', title: 'Publications', description: 'Searchable list of publications from the Large Scale Hydrology group.', body, path: '/publications.html' });
}

/* ---------- Data ---------- */

export function dataPage(ctx) {
  const { items } = ctx.api.datasets;
  const body = html`
    ${pageHead({
      scene: 'qilian',
      en: 'Data products',
      zh: '数据产品',
      lead: t('Gridded evapotranspiration, gross primary production and terrestrial water storage products, free to download.', '免费开放的蒸散发、总初级生产力和陆地水储量格点数据产品。'),
    })}
    <section class="wrap">
      <h2 class="minor">${t('Temporal coverage', '时间覆盖')}</h2>
      ${coverage(ctx)}
    </section>
    <div class="wrap datasets">
      ${items.map(
        (d) => html`<article class="dataset" id="${d.id}">
          <div>
            <h2>${d.name}</h2>
            <p>${t(d.summary_en, d.summary_zh)}</p>
            <div class="table-scroll"><table class="table table--spec"><tbody>
              <tr><th scope="row">${t('Scope', '范围')}</th><td>${d.scope}</td></tr>
              <tr><th scope="row">${t('Variables', '变量')}</th><td>${d.variables}</td></tr>
              <tr><th scope="row">${t('Time step', '时间分辨率')}</th><td>${d.temporal}</td></tr>
              <tr><th scope="row">${t('Grid', '空间分辨率')}</th><td>${d.spatial}</td></tr>
              <tr><th scope="row">${t('Period', '时段')}</th><td>${d.coverage_label}</td></tr>
            </tbody></table></div>
            <h3>${t('Download', '下载')}</h3>
            <ul class="plain">${d.downloads.map((link) => html`<li><a class="link" href="${safeHref(link.url)}" target="_blank" rel="noopener">${link.label}</a></li>`)}</ul>
            <h3>${t('How to cite', '引用方式')}</h3>
            <ol class="cite">${d.citations.map((c) => html`<li><p>${c}</p><button class="link" type="button" data-copy="${c}">${t('Copy citation', '复制引用')}</button></li>`)}</ol>
          </div>
          ${d.image_id ? fig(ctx, d.image_id, { alt: `${d.name} figure`, sizes: '(max-width: 1000px) 100vw, 520px' }) : ''}
        </article>`,
      )}
    </div>`;
  return layout(ctx, { page: 'data', title: 'Data', description: 'Open global and regional evapotranspiration, GPP and terrestrial water storage datasets: PML_v2, PML_v2.2, PML_v2-China and GRACE-Transformer-Gap.', body, path: '/data.html' });
}

/* ---------- People ---------- */

function personTile(ctx, person) {
  const name = [person.honorific, person.name_en].filter(Boolean).join(' ');
  const search = `${person.name_en} ${person.name_zh} ${person.research_field} ${person.research_field_zh || ''}`.toLowerCase();
  return html`<li class="person" data-search="${search}" id="p-${person.id}">
    <button class="person__btn" type="button" data-person aria-haspopup="dialog">
      <span class="person__media">${picture(ctx, person.photo_id, { sizes: '(max-width: 760px) 46vw, (max-width: 1080px) 30vw, 282px', alt: '', style: `object-position:${person.photo_focus}` })}</span>
      <span class="person__copy">
        <span class="person__name">${t(person.name_en, person.name_zh)}</span>
        <span class="person__field">${t(person.research_field, person.research_field_zh)}</span>
      </span>
    </button><div class="person__footer">${personLinks(person)}</div>
    <div class="person__detail">
      ${picture(ctx, person.photo_id, { sizes: '220px', alt: `Portrait of ${name}`, style: `object-position:${person.photo_focus}` })}
      <div>
        <h3>${t(name, person.name_zh || name)}</h3>
        <p class="meta">${t(person.research_field, person.research_field_zh)}</p>${person.bio_en || person.bio_zh ? html`<div class="person__bio">${paragraphs((person.bio_en || person.bio_zh).split(/\n\s*\n/), 'en')}${paragraphs((person.bio_zh || person.bio_en).split(/\n\s*\n/), 'zh')}</div>` : ''}${personLinks(person)}
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
  const assets = site['site.assets'];

  const body = html`
    <header class="people-head">
      <div class="wrap">
        <p class="kicker">${t('Large Scale Hydrology · IGSNRR, CAS', '大尺度水文学团队 · 中国科学院地理科学与资源研究所')}</p>
        <div class="people-head__row">
          <h1>${t('People', '团队成员')}</h1>
          <p>${t('The people behind our research into water, climate and a changing world.', '探索水循环、气候与变化世界的科研伙伴。')}</p>
        </div>
        <div class="people-head__meta">
          <span>${t(`${meta.counts.people} researchers & students`, `${meta.counts.people} 位科研人员与学生`)}</span>
          <span>${t(`${meta.counts.alumni} alumni`, `${meta.counts.alumni} 位校友`)}</span>
          <span>${t('Beijing, China', '中国 · 北京')}</span>
        </div>
      </div>
    </header>
    ${pi
      ? html`<section class="wrap pi" id="pi">
          <div class="pi__side">
            ${picture(ctx, pi.photo_id, { cls: 'pi__photo', sizes: '(max-width: 560px) 120px, (max-width: 760px) 160px, 240px', alt: `Portrait of ${pi.honorific} ${pi.name_en}`, style: `object-position:${pi.photo_focus}` })}
            ${personLinks(pi)}
          </div>
          <div class="pi__text">
            <p class="kicker">${t('Principal Investigator', '团队负责人')}</p>
            <h2>${t(`${pi.honorific} ${pi.name_en}`, `${pi.name_zh}研究员`)}</h2>
            <p class="pi__role">${t(piSetting.title_en, piSetting.title_zh)}</p>
            ${paragraphs((pi.bio_en || piSetting.bio_en[0]).split(/\n\s*\n/), 'en')}
            ${paragraphs((pi.bio_zh || piSetting.bio_zh[0]).split(/\n\s*\n/), 'zh')}
            <details class="pi__more">
              <summary>${t('More about the group & principal investigator', '了解更多团队与负责人介绍')}</summary>
              ${paragraphs(piSetting.bio_en, 'en')}
              ${paragraphs(piSetting.bio_zh, 'zh')}
            </details>
          </div>
          <dl class="pi__stats">${stats.map((s) => html`<div><dt>${t(s.label_en, s.label_zh)}</dt><dd>${s.value.toLocaleString('en-US')}${s.suffix}</dd></div>`)}</dl>
        </section>`
      : ''}
    <section class="wrap people-directory" data-module="peoplefilter">
      <div class="filters">
        <label class="field"><span class="sr-only">Search people</span><input type="search" data-people-q placeholder="Search name or research field" data-placeholder-zh="搜索姓名或研究方向" autocomplete="off"></label>
        <div class="tags" role="group" aria-label="Filter by role">
          <button type="button" class="tag is-on" data-people-role="" aria-pressed="true">${t('Everyone', '全部')}</button>
          ${groups.map((g) => html`<button type="button" class="tag" data-people-role="${g.key}" aria-pressed="false">${t(g.label.en, g.label.zh)} (${g.members.length})</button>`)}
        </div>
      </div>
      ${groups.map(
        (g) => html`<section class="group" data-group="${g.key}" id="${g.key}">
          <div class="group__heading"><h2>${t(g.label.en, g.label.zh)}</h2><span class="group__count">${t(`${g.members.length} ${g.members.length === 1 ? 'member' : 'members'}`, `${g.members.length} 位成员`)}</span></div>
          <ul class="people-grid">${g.members.map((m) => personTile(ctx, m))}</ul>
        </section>`,
      )}
    </section>
    <section class="wrap">
      <figure class="plate plate--wide">
        ${picture(ctx, assets.group_photo, { sizes: '(max-width: 1240px) 100vw, 1200px', alt: 'Group photo at the 2026 graduation ceremony' })}
        <figcaption>${t('Group photo at the 2026 graduation ceremony.', '2026 年毕业典礼团队合影。')}</figcaption>
      </figure>
    </section>
    <dialog class="sheet" data-person-dialog aria-labelledby="person-dialog-title">
      <div class="sheet__tools">
        <button class="tool tool--text" type="button" data-lang-toggle aria-label="Switch language: English or Chinese"><span class="t-en">中文</span><span class="t-zh">English</span></button>
        <button class="tool" type="button" data-dialog-close><span class="sr-only">${t('Close', '关闭')}</span><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m4 4 12 12M16 4 4 16" stroke="currentColor" stroke-width="1.5"/></svg></button>
      </div>
      <div data-person-slot></div>
    </dialog>`;
  return layout(ctx, { page: 'people', title: 'People', description: 'Members and alumni of the Large Scale Hydrology group led by Prof. Yongqiang Zhang (张永强) at IGSNRR, Chinese Academy of Sciences.', body, path: '/people.html' });
}

/* ---------- News ---------- */

export function newsPage(ctx) {
  const { items } = ctx.api.news;
  const years = [...new Set(items.map((n) => n.year))].sort((a, b) => b - a);
  const body = html`
    ${pageHead({ en: 'News', zh: '新闻动态', scene: 'gorges' })}
    <div class="wrap">
      ${years.map(
        (year) => html`<section class="year">
          <h2>${year}</h2>
          <ul class="newslist">
            ${items.filter((n) => n.year === year).map(
              (n) => html`<li>
                <a href="${safeHref(newsHref(n))}" ${newsTarget(n)}>
                  <span class="newslist__fig">${picture(ctx, n.cover_id, { sizes: '180px' })}</span>
                  <span>
                    <span class="meta">${newsDate(n)} · ${categoryLabel(n.category)}</span>
                    <span class="newslist__title">${t(n.title_en, n.title_zh)}</span>
                    ${n.summary_en || n.summary_zh ? html`<span class="newslist__summary">${t(n.summary_en, n.summary_zh)}</span>` : ''}
                  </span>
                </a>
              </li>`,
            )}
          </ul>
        </section>`,
      )}
    </div>`;
  return layout(ctx, { page: 'news', title: 'News', description: 'News from the Large Scale Hydrology group.', body, path: '/news.html' });
}

export function articlePage(ctx, n) {
  const figure = (id, alt) => html`<figure class="fig">${picture(ctx, id, { sizes: '(max-width: 800px) 100vw, 760px', alt })}</figure>`;
  const portrait = ctx.api.people.groups.some((group) => group.members.some((p) => p.photo_id === n.cover_id));
  const body = html`
    <article class="article">
      <header class="wrap article__head">
        <p class="kicker"><a href="/">${t('Home', '首页')}</a> / <a href="/news.html">${t('News', '新闻动态')}</a></p>
        <h1>${t(n.title_en, n.title_zh)}</h1>
        <p class="meta">${n.date || n.year} · ${categoryLabel(n.category)}</p>
        ${n.summary_en || n.summary_zh ? html`<p class="pagehead__lead">${t(n.summary_en, n.summary_zh)}</p>` : ''}
      </header>
      ${n.cover_id ? html`<div class="wrap article__cover ${portrait ? 'article__cover--portrait' : ''}">${fig(ctx, n.cover_id, { sizes: portrait ? '280px' : '(max-width: 800px) 100vw, 760px' })}</div>` : ''}
      <div class="wrap article__body" lang="zh-CN">${renderMarkdown(n.body_md, figure)}</div>
      <footer class="wrap article__foot">
        ${n.source_url ? more(n.source_url, 'Original article', '阅读原文', { out: true }) : ''}
        ${more('/news.html', 'All news', '全部新闻')}
      </footer>
    </article>`;
  return layout(ctx, { page: 'news', title: n.title_en || n.title_zh, description: n.summary_en || n.summary_zh || n.title_en || n.title_zh, body, path: `/news/${encodeURIComponent(n.id)}.html`, image: ctx.images[n.cover_id]?.src });
}

/* ---------- Collaboration ---------- */

const WIDTH = 1000;
const project = (lon, lat, height, [south, north]) => [((lon + 180) / 360) * WIDTH, ((north - lat) / (north - south)) * height];

const CITY_ZH = { Beijing: '北京', Vienna: '维也纳', Potsdam: '波茨坦', Ghent: '根特', 'Richland, WA': '里奇兰', 'Irvine, CA': '尔湾', Canberra: '堪培拉' };
const city = (name) => html`<tspan class="t-en">${name}</tspan><tspan class="t-zh">${CITY_ZH[name] ?? name}</tspan>`;

/** The institute in Beijing, where the network's lines start. */
const HOME = { lon: 116.39, lat: 39.99 };

/** A curve from a to b, bowed northwards so that the lines fan out instead of overlapping. */
function arc([x1, y1], [x2, y2]) {
  const length = Math.hypot(x2 - x1, y2 - y1);
  const lift = Math.min(length * 0.24, 96);
  const dx = (x2 - x1) / length;
  const dy = (y2 - y1) / length;
  const side = dx < 0 ? -1 : 1;
  const cx = (x1 + x2) / 2 + dy * lift * side;
  const cy = (y1 + y2) / 2 - dx * lift * side;
  return `M${x1.toFixed(1)} ${y1.toFixed(1)}Q${cx.toFixed(1)} ${cy.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`;
}

/** The cities of the network, each once, whoever works there. */
function collaboratorCities(items) {
  const places = new Map();
  for (const c of items) {
    if (c.lat == null || c.lon == null) continue;
    const key = `${c.lat},${c.lon}`;
    if (!places.has(key)) places.set(key, { city: c.city, lat: c.lat, lon: c.lon, ids: [] });
    places.get(key).ids.push(c.id);
  }
  return [...places.values()];
}

/** The live globe. It only appears once it is running, and the flat map is the fallback. */
function networkGlobe(ctx) {
  const cities = collaboratorCities(ctx.api.collaborators.items);
  return html`<div class="netglobe" data-module="collabglobe" data-lon="${HOME.lon}" data-lat="${HOME.lat}">
    <canvas class="netglobe__canvas" aria-hidden="true"></canvas>
    <ul class="netglobe__cities">
      ${cities.map((c) => html`<li><a href="#${c.ids[0]}" data-city="${c.city}" data-lon="${c.lon}" data-lat="${c.lat}">${city(c.city)}</a></li>`)}
    </ul>
    ${pauseButton()}
  </div>`;
}

function worldMap(ctx) {
  const items = ctx.api.collaborators.items;
  const { latRange, dots, step } = worldDots;
  const height = Math.round((WIDTH * (latRange[1] - latRange[0])) / 360);
  const land = dots.map(([lon, lat]) => {
    const [x, y] = project(lon, lat, height, latRange);
    return `M${x.toFixed(1)} ${y.toFixed(1)}h0`;
  });
  const home = project(HOME.lon, HOME.lat, height, latRange);

  const distance = ([x, y]) => Math.hypot(x - home[0], y - home[1]);
  const points = collaboratorCities(items)
    .map((place) => ({ place, xy: project(place.lon, place.lat, height, latRange) }))
    .sort((a, b) => distance(a.xy) - distance(b.xy));

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

  return html`<svg class="worldmap" viewBox="0 0 ${WIDTH} ${height}" role="group" aria-label="World map with lines linking Beijing to the cities of collaborating institutions">
    <path class="worldmap__land" d="${land.join('')}" style="stroke-width:${((step / 360) * WIDTH * 0.62).toFixed(2)}px"/>
    <g aria-hidden="true">
      ${points.map(({ place, xy }, i) => html`<path class="net__arc" data-place="${place.ids.join(' ')}" d="${arc(home, xy)}" pathLength="1" style="--i:${i}"/>`)}
    </g>
    ${points.map(({ place, xy }, i) => {
      const [x, y] = xy;
      const label = labelFor(xy);
      return html`<a href="#${place.ids[0]}" aria-label="${place.city}" data-place="${place.ids.join(' ')}"><g class="worldmap__place" style="--i:${i}">
        <circle class="worldmap__halo" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="9"/>
        <circle class="worldmap__node" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4"/>
        <text x="${label.x.toFixed(1)}" y="${label.y.toFixed(1)}" text-anchor="${label.anchor}">${city(place.city)}</text>
      </g></a>`;
    })}
    <g class="worldmap__home">
      <circle class="worldmap__halo" cx="${home[0].toFixed(1)}" cy="${home[1].toFixed(1)}" r="11"/>
      <circle class="worldmap__node" cx="${home[0].toFixed(1)}" cy="${home[1].toFixed(1)}" r="5"/>
      <text x="${(home[0] + 10).toFixed(1)}" y="${(home[1] + 24).toFixed(1)}" text-anchor="end">${city('Beijing')}</text>
    </g>
  </svg>`;
}

export function collaborationPage(ctx) {
  const { items } = ctx.api.collaborators;
  const body = html`
    ${pageHead({
      scene: 'alps',
      en: 'Collaboration',
      zh: '合作网络',
      lead: t('The group works with hydrologists and climate scientists in Europe, North America and Australia.', '团队与欧洲、北美和澳大利亚的水文与气候科学家开展合作。'),
    })}
    <section class="wrap" data-module="collabmap">
      <figure class="plate plate--map">
        ${networkGlobe(ctx)}
        ${worldMap(ctx)}
        <figcaption>${t('Lines link Beijing with the cities of collaborating institutions.', '线条连接北京与合作机构所在城市。')}</figcaption>
      </figure>
      <ul class="collabs">
        ${items.map(
          (c) => html`<li class="collab" id="${c.id}" data-city="${c.city}">
            ${picture(ctx, c.photo_id, { sizes: '112px', alt: `Portrait of ${c.name}`, style: 'object-position:50% 20%' })}
            <div>
              <h2>${c.name}</h2>
              <p class="meta">${c.institute}${c.city ? `, ${c.city}` : ''}</p>
              <p>${c.bio}</p>
            </div>
          </li>`,
        )}
      </ul>
    </section>`;
  return layout(ctx, { page: 'collaboration', title: 'Collaboration', description: 'International collaborators of the Large Scale Hydrology group.', body, path: '/collaboration.html' });
}

/* ---------- 404 ---------- */

export function notFoundPage(ctx) {
  const body = html`<header class="pagehead">
    <div class="wrap">
      <p class="kicker">404</p>
      <h1>${t('Page not found', '页面不存在')}</h1>
      <p class="pagehead__lead">${t('The page may have moved. Older files from the previous site are no longer available at their original addresses.', '该页面可能已移动。旧版网站的文件已不在原地址提供。')}</p>
      ${more('/', 'Return to the homepage', '返回首页')}
    </div>
  </header>`;
  return layout(ctx, { page: '404', title: 'Page not found', description: 'Page not found.', body, path: '/404.html' });
}
