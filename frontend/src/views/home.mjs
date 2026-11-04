import { html, raw, safeHref, t } from '../lib/html.mjs';
import { budgetSection } from './charts.mjs';
import { layout } from './layout.mjs';
import { external, fig, journalMetrics, more, paragraphs, pauseButton, picture, piHonours, section, themeView } from './parts.mjs';

export const newsHref = (n) => (n.body_md ? `/news/${encodeURIComponent(n.id)}.html` : n.source_url || '/news.html');
export const newsTarget = (n) => (n.body_md ? '' : raw('target="_blank" rel="noopener"'));
export const newsDate = (n) => n.date || String(n.year);

const CATEGORY = {
  news: ['News', '新闻'],
  publication: ['Publication', '论文'],
  award: ['Honour', '荣誉'],
  event: ['Event', '活动'],
};
export const categoryLabel = (key) => t(...(CATEGORY[key] ?? CATEGORY.news));

/** Rivers named on the globe, each placed on its own channel. */
const RIVERS = [
  ['Yangtze', '长江', 112.6, 30.2],
  ['Yellow River', '黄河', 109.6, 37.5],
  ['Mekong', '湄公河', 101.6, 18.6],
  ['Ganges', '恒河', 82.5, 25.4],
  ['Lena', '勒拿河', 125.0, 62.0],
  ['Yenisei', '叶尼塞河', 90.0, 60.0],
  ['Volga', '伏尔加河', 47.0, 52.0],
  ['Danube', '多瑙河', 19.0, 45.5],
  ['Nile', '尼罗河', 32.5, 15.5],
  ['Niger', '尼日尔河', 3.0, 13.0],
  ['Congo', '刚果河', 22.0, 0.5],
  ['Murray', '墨累河', 143.5, -34.4],
  ['Amazon', '亚马孙河', -60.0, -3.2],
  ['Paraná', '巴拉那河', -59.0, -28.0],
  ['Mississippi', '密西西比河', -90.5, 35.0],
  ['Mackenzie', '马更些河', -125.0, 64.0],
];

function hero(ctx) {
  const { site, people } = ctx.api;
  const lab = site['site.lab'];
  const pi = people.groups.find((g) => g.key === 'pi')?.members[0];
  return html`<section class="hero">
    <figure class="earth" data-module="earth">
      <img class="earth__still" src="/earth/earth-still.webp" width="1200" height="1200" alt="The Earth with its river network drawn in blue" decoding="async" fetchpriority="high">
      <canvas class="earth__canvas" aria-hidden="true"></canvas>
      <ol class="earth__labels" aria-hidden="true">
        ${RIVERS.map(([en, zh, lon, lat]) => html`<li data-lon="${lon}" data-lat="${lat}"><span>${t(en, zh)}</span></li>`)}
      </ol>
      ${pauseButton()}
    </figure>
    <div class="wrap hero__grid">
      <div class="hero__text">
        <p class="kicker">${t(lab.institute_en, lab.institute_zh)}</p>
        <h1>${t(`${lab.name_en} Group`, lab.name_zh)}</h1>
        <p class="hero__lead">${t(lab.statement_en, lab.statement_zh)}</p>
        ${pi
          ? html`<p class="hero__pi">${t('Principal Investigator: ', '团队负责人：')}<a class="link" href="/people.html#pi">${t(`${pi.honorific} ${pi.name_en}`, `${pi.name_zh}研究员`)}</a></p>`
          : ''}
        <p class="hero__actions">
          <a class="btn btn--solid" href="/research.html">${t('Our research', '研究方向')}</a>
          <a class="btn" href="/data.html">${t('Data products', '数据产品')}</a>
        </p>
      </div>
    </div>
    <p class="hero__note wrap">${t(
      html`River size is an estimate from the long-term water balance, P − ET, routed downstream at 0.1°. It is not gauged discharge.<span class="hero__drag"> Drag to turn the globe.</span>`,
      html`河流粗细由多年平均水量平衡（P − ET）按 0.1° 逐级汇流估算，并非实测流量。<span class="hero__drag">拖动可旋转地球。</span>`,
    )}</p>
  </section>`;
}

/** The group's own introduction, with the part about the PI folded below it. */
function about(ctx) {
  const { bio_en: en, bio_zh: zh } = ctx.api.site['site.pi'];
  const { cover } = ctx.api.site['site.assets'];
  return section({
    en: 'About the group',
    zh: '课题组简介',
    aside: more('/people.html', 'Meet the team', '团队成员'),
    body: html`<div class="about">
      <div class="about__text">
        ${paragraphs(en.slice(2), 'en')}
        ${paragraphs(zh.slice(2), 'zh')}
      </div>
      <figure class="about__photo">${picture(ctx, cover, { sizes: '(max-width: 1000px) 100vw, 420px' })}</figure>
      <details class="about__more">
        <summary>${t('About the Principal Investigator', '团队负责人简介')}</summary>
        ${piHonours(ctx)}
        ${paragraphs(en.slice(0, 2), 'en')}
        ${paragraphs(zh.slice(0, 2), 'zh')}
      </details>
    </div>`,
  });
}

function metrics(ctx) {
  const stats = ctx.api.site['site.stats'];
  return html`<section class="band" aria-label="Group metrics" data-module="contours">
    <canvas class="band__field" aria-hidden="true"></canvas>
    ${pauseButton()}
    <div class="wrap">
      <dl class="metrics">
        ${stats.map(
          (s) => html`<div>
            <dd data-count="${s.value}" data-suffix="${s.suffix}">${s.value.toLocaleString('en-US')}${s.suffix}</dd>
            <dt>${t(s.label_en, s.label_zh)}</dt>
          </div>`,
        )}
      </dl>
    </div>
  </section>`;
}

function news(ctx) {
  const { items } = ctx.api.news;
  const lead = items.filter((n) => n.featured).slice(0, 3);
  const rest = items.filter((n) => !lead.includes(n)).slice(0, 3);
  return section({
    en: 'News',
    zh: '新闻动态',
    aside: more('/news.html', 'All news', '全部新闻'),
    body: html`
      <ul class="briefs">
        ${lead.map(
          (n) => html`<li>
            <a href="${safeHref(newsHref(n))}" ${newsTarget(n)}>
              <span class="brief__fig">${picture(ctx, n.cover_id, { sizes: '(max-width: 760px) 100vw, 300px' })}</span>
              <span class="meta">${newsDate(n)} · ${categoryLabel(n.category)}</span>
              <span class="brief__title">${t(n.title_en, n.title_zh)}</span>
            </a>
          </li>`,
        )}
      </ul>
      <ul class="rows">
        ${rest.map(
          (n) => html`<li>
            <a href="${safeHref(newsHref(n))}" ${newsTarget(n)}>
              <span class="meta">${newsDate(n)}</span>
              <span class="meta">${categoryLabel(n.category)}</span>
              <span class="rows__title">${t(n.title_en, n.title_zh)}</span>
            </a>
          </li>`,
        )}
      </ul>`,
  });
}

function research(ctx) {
  const { themes } = ctx.api.research;
  return html`<section class="sky" id="research">
    <div class="wrap">
      <header class="sky__head">
        <h2>${t('Research', '研究方向')}</h2>
        ${more('/research.html', 'All research', '全部研究')}
      </header>
      <ol class="cards">
        ${themes.map(
          (theme) => html`<li class="card" data-tilt>
            ${themeView(theme.id, { cls: 'card__block', readout: false })}
            <div class="card__text">
              <h3><a class="card__link" href="/research.html#${theme.id}">${t(theme.title_en, theme.title_zh)}</a></h3>
              <p>${t(theme.summary_en, theme.summary_zh)}</p>
              <p class="meta">${t(theme.projects.map((p) => p.name).join(' · '), theme.projects.map((p) => p.name_zh || p.name).join(' · '))}</p>
            </div>
          </li>`,
        )}
      </ol>
    </div>
  </section>`;
}

/** The DOI of the study that the water budget comes from, which is featured on its own. */
const budgetDoi = (ctx) => (ctx.api.site['site.water_budget']?.source?.url ?? '').replace(/^https?:\/\/(dx\.)?doi\.org\//, '').toLowerCase();

function chosen(ctx) {
  const list = ctx.api.site['site.featured_research'] ?? [];
  const byDoi = new Map(ctx.api.publications.items.map((p) => [p.doi?.toLowerCase(), p]));
  return list
    .map((f) => ({ ...f, pub: byDoi.get(f.doi.toLowerCase()), story: f.news_id ? ctx.api.news.items.find((n) => n.id === f.news_id) : null }))
    .filter((f) => f.pub);
}

const paperLinks = (f) => html`<p class="feat__links">
    <a class="link" href="https://doi.org/${f.pub.doi}" target="_blank" rel="noopener">${t('Read the paper', '阅读论文')}${external}</a>
    ${f.story ? html`<a class="link" href="${safeHref(newsHref(f.story))}" ${newsTarget(f.story)}>${t('News story', '新闻报道')}</a>` : ''}
  </p>`;

/**
 * Newest first. Papers carry only a year, so within a year the date of the paper's news story
 * decides, and a paper without one follows the dated ones, as in the news list.
 */
const newestFirst = (a, b) => b.pub.year - a.pub.year || (b.story?.date ?? '').localeCompare(a.story?.date ?? '');

/** The group's key results, chosen in the site.featured_research setting, newest first. */
function achievements(ctx) {
  const spotlight = budgetDoi(ctx);
  const items = chosen(ctx)
    .filter((f) => f.doi.toLowerCase() !== spotlight)
    .sort(newestFirst);
  if (!items.length) return '';

  const head = (f) => html`<p class="feat__journal">
      <cite class="jname">${f.pub.venue}</cite>
      <span class="meta">${f.pub.year}</span>
    </p>
    <span class="jm-row">${journalMetrics(ctx, f.pub.venue)}</span>`;
  const [lead, ...rest] = items;

  return html`<section class="sec feat" id="achievements">
    <div class="wrap">
      <header class="feat__head">
        <h2>${t('Representative achievements', '代表性成果')}</h2>
        <p class="note">${t('Key results of the group, with the journal, impact factor and CAS quartile of each paper.', '课题组代表性研究成果，并标注期刊、影响因子与中科院分区。')}</p>
        ${more('/publications.html?only=flag', 'All flagship papers', '全部旗舰期刊论文')}
      </header>
      <article class="feat__lead">
        <div class="feat__figure">${lead.image_id ? fig(ctx, lead.image_id, { sizes: '(max-width: 1000px) 100vw, 720px' }) : ''}</div>
        <div class="feat__text">
          ${head(lead)}
          <h3 class="feat__title"><a href="https://doi.org/${lead.pub.doi}" target="_blank" rel="noopener">${lead.pub.title}</a></h3>
          <p class="feat__finding">${t(lead.finding_en, lead.finding_zh)}</p>
          ${paperLinks(lead)}
        </div>
      </article>
      <ol class="feat__grid">
        ${rest.map(
          (f) => html`<li class="feat__card">
            ${f.image_id && ctx.images[f.image_id]
              ? html`<button class="feat__thumb" type="button" data-zoom aria-label="Enlarge: ${ctx.mediaById.get(f.image_id)?.alt_en ?? f.pub.title}">${picture(ctx, f.image_id, { sizes: '(max-width: 760px) 100vw, 380px' })}</button>`
              : html`<div class="feat__thumb feat__thumb--type" aria-hidden="true"><span>${f.pub.venue}</span><span>${f.pub.year}</span></div>`}
            ${head(f)}
            <h3 class="feat__title"><a href="https://doi.org/${f.pub.doi}" target="_blank" rel="noopener">${f.pub.title}</a></h3>
            <p class="feat__finding">${t(f.finding_en, f.finding_zh)}</p>
            ${paperLinks(f)}
          </li>`,
        )}
      </ol>
    </div>
  </section>`;
}

/** "Zhang, Y., Blöschl, G., Wei, H. et al." from a full APA author list. */
function shortAuthors(authors = '') {
  const names = authors.match(/[^,&]+?,\s(?:[A-Z][a-z]?\.[\s-]?)+/g)?.map((n) => n.trim()) ?? [];
  return names.length > 3 ? `${names.slice(0, 3).join(', ')} et al.` : authors;
}

/**
 * The featured study, under the journal's own name, with the water budget it measured. The
 * masthead is set in type, as a journal's name is in a reference list; no logo is copied.
 */
function featuredResearch(ctx) {
  const doi = budgetDoi(ctx);
  const f = chosen(ctx).find((x) => x.doi.toLowerCase() === doi);
  const pub = f?.pub ?? ctx.api.publications.items.find((p) => p.doi?.toLowerCase() === doi);
  if (!pub) return budgetSection(ctx);
  const [first, ...rest] = pub.venue.toLowerCase().split(' ');
  const pages = String(pub.pages ?? '').replace('-', '–');

  return html`<section class="spot" id="featured" aria-labelledby="featured-title">
    <div class="wrap">
      <div class="spot__grid">
        <header class="spot__head">
          <p class="kicker spot__kicker">${t('Featured research', '重点研究')}</p>
          <p class="masthead" aria-label="${pub.venue}"><b>${first}</b> ${rest.join(' ')}</p>
          <p class="masthead__issue meta">${t(`Volume ${pub.volume} · Issue ${pub.issue} · ${pub.year} · pp. ${pages}`, `${pub.year} 年 · 第 ${pub.volume} 卷第 ${pub.issue} 期 · ${pages} 页`)}</p>
          <h2 class="spot__title" id="featured-title"><a href="https://doi.org/${pub.doi}" target="_blank" rel="noopener">${pub.title}</a></h2>
          <p class="spot__authors">${shortAuthors(pub.authors)}</p>
          ${f ? html`<p class="spot__finding">${t(f.finding_en, f.finding_zh)}</p>` : ''}
          ${f ? paperLinks(f) : ''}
          <p class="spot__doi meta">DOI <a class="link" href="https://doi.org/${pub.doi}" target="_blank" rel="noopener">${pub.doi}</a></p>
        </header>
        ${f?.image_id ? html`<div class="spot__figure">${fig(ctx, f.image_id, { sizes: '(max-width: 1000px) 100vw, 560px', en: 'The global water cycle as updated by the study, with fluxes for the historical and future periods.', zh: '该研究更新的全球水循环图，含历史与未来时期的通量。' })}</div>` : ''}
      </div>
    </div>
    ${budgetSection(ctx, { nested: true })}
  </section>`;
}

/** The inputs of the river network on the globe, drawn as the stack of maps they are. */
const LAYERS = [
  ['river', 'River flow', '河川径流', 'Accumulated downstream', '沿河网累加'],
  ['et', 'Evapotranspiration', '蒸散发', 'PML-V2.2, 2001–2020', 'PML-V2.2，2001–2020 年'],
  ['pre', 'Precipitation', '降水', 'CRU TS 4.09, 2001–2020', 'CRU TS 4.09，2001–2020 年'],
  ['dem', 'Elevation', '高程', '1 km terrain model', '1 km 地形模型'],
];

function data(ctx) {
  const { items } = ctx.api.datasets;
  return section({
    en: 'Data products',
    zh: '数据产品',
    aside: more('/data.html', 'Download and cite', '下载与引用'),
    body: html`<figure class="layers">
      <ol class="layers__stack">
        ${LAYERS.map(
          ([id, en, zh, noteEn, noteZh], i) => html`<li style="--i:${i}">
            <div class="layers__map"><img src="/earth/layer-${id}.webp" width="720" height="280" alt="Global map of ${en.toLowerCase()}" loading="lazy" decoding="async"></div>
            <p><b>${t(en, zh)}</b> ${t(noteEn, noteZh)}</p>
          </li>`,
        )}
      </ol>
      <figcaption>${t(
        'How the rivers on the globe were computed: precipitation minus evapotranspiration from our PML-V2.2 product, routed over the 1 km terrain model. Precipitation: CRU TS 4.09 (Harris et al., 2020). No coastline, lake or river dataset is used: land, sea and channels all come from the terrain.',
        '地球上的河流由此算得：降水减去本组 PML-V2.2 产品的蒸散发，再沿 1 km 地形模型汇流。降水来自 CRU TS 4.09（Harris 等，2020）。未使用任何海岸线、湖泊或河道数据，陆地、海洋与河道均由地形得到。',
      )}</figcaption>
    </figure>
    <div class="table-scroll"><table class="table">
      <thead><tr>
        <th scope="col">${t('Product', '产品')}</th>
        <th scope="col">${t('Variables', '变量')}</th>
        <th scope="col">${t('Scope', '范围')}</th>
        <th scope="col">${t('Time step', '时间分辨率')}</th>
        <th scope="col">${t('Grid', '空间分辨率')}</th>
        <th scope="col">${t('Period', '时段')}</th>
      </tr></thead>
      <tbody>
        ${items.map(
          (d) => html`<tr>
            <th scope="row"><a class="link" href="/data.html#${d.id}">${d.name}</a></th>
            <td>${d.variables}</td>
            <td>${d.scope}</td>
            <td>${d.temporal}</td>
            <td>${d.spatial}</td>
            <td>${d.coverage_label}</td>
          </tr>`,
        )}
      </tbody>
    </table></div>`,
  });
}

function people(ctx) {
  const { people: team, site, meta } = ctx.api;
  const assets = site['site.assets'];
  const piSetting = site['site.pi'];
  const pi = team.groups.find((g) => g.key === 'pi')?.members[0];
  const active = team.groups.filter((g) => !['alumni', 'pi'].includes(g.key));
  return section({
    en: 'People',
    zh: '团队成员',
    aside: html`${more('/people.html', 'All members', '全部成员')}
      <p class="note">${t(`${meta.counts.people} members and ${meta.counts.alumni} alumni.`, `现有成员 ${meta.counts.people} 人，校友 ${meta.counts.alumni} 人。`)}</p>`,
    body: html`
      ${pi
        ? html`<div class="pi-card">
            ${picture(ctx, pi.photo_id, { sizes: '180px', alt: `Portrait of ${pi.honorific} ${pi.name_en}`, style: `object-position:${pi.photo_focus}` })}
            <div>
              <h3><a href="/people.html#pi">${t(`${pi.honorific} ${pi.name_en}`, `${pi.name_zh}研究员`)}</a></h3>
              <p class="pi-card__role">${t(piSetting.title_en, piSetting.title_zh)}</p>
              <p><a class="link" href="mailto:${pi.email}">${pi.email}</a></p>
              <ul class="counts">${active.map((g) => html`<li>${t(g.label.en, g.label.zh)}: ${g.members.length}</li>`)}</ul>
            </div>
          </div>`
        : ''}
      <figure class="plate">
        ${picture(ctx, assets.group_photo_alt, { sizes: '(max-width: 1000px) 100vw, 860px' })}
        <figcaption>${t('Group photo.', '团队合影。')}</figcaption>
      </figure>`,
  });
}

function positions(ctx) {
  const r = ctx.api.site['site.recruitment'];
  const contact = ctx.api.site['site.contact'];
  const col = (en, zh, items) => html`<div><h3>${t(en, zh)}</h3><ul>${items.map((x) => html`<li>${t(x.en, x.zh)}</li>`)}</ul></div>`;
  return section({
    id: 'join',
    cls: 'sec--sky',
    en: r.title_en,
    zh: r.title_zh,
    body: html`
      <p class="prose-lead">${t(r.body_en, r.body_zh)}</p>
      <div class="positions">
        ${col('Openings', '招收', r.openings)}
        ${col('Topics', '研究方向', r.topics)}
        ${col('Skills', '技能', r.skills)}
      </div>
      <p>${t('Applications and enquiries:', '申请与咨询：')} <a class="link" href="mailto:${contact.email}">${contact.email}</a></p>`,
  });
}

export function homePage(ctx) {
  const lab = ctx.api.site['site.lab'];
  const body = html`
    ${hero(ctx)}
    ${about(ctx)}
    ${metrics(ctx)}
    ${news(ctx)}
    ${research(ctx)}
    ${achievements(ctx)}
    ${data(ctx)}
    ${people(ctx)}
    ${positions(ctx)}
    ${featuredResearch(ctx)}`;
  return layout(ctx, { page: 'home', description: `${lab.name_en} group at ${lab.institute_en}. ${lab.tagline_en}`, body, path: '/' });
}
