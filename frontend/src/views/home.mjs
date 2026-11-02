import { html, raw, safeHref, t } from '../lib/html.mjs';
import { budgetSection } from './charts.mjs';
import { layout } from './layout.mjs';
import { more, paragraphs, pauseButton, picture, pubItem, section } from './parts.mjs';

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
        ${paragraphs(en.slice(0, 2), 'en')}
        ${paragraphs(zh.slice(0, 2), 'zh')}
      </details>
    </div>`,
  });
}

function metrics(ctx) {
  const stats = ctx.api.site['site.stats'];
  return html`<section class="band" aria-label="Group metrics" data-module="swell">
    <canvas class="band__sea" aria-hidden="true"></canvas>
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

/** Each programme is shown with a place its work is about. */
const THEME_BLOCK = {
  'water-cycle': 'hengduan',
  'water-security': 'gorges',
  'water-innovation': 'alps',
};

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
            <a href="/research.html#${theme.id}">
              <img class="card__block" src="/earth/${THEME_BLOCK[theme.id] ?? 'hengduan'}-still.webp" width="960" height="640" alt="" loading="lazy" decoding="async">
              <h3>${t(theme.title_en, theme.title_zh)}</h3>
              <p>${t(theme.summary_en, theme.summary_zh)}</p>
              <p class="meta">${theme.projects.map((p) => p.name).join(' · ')}</p>
            </a>
          </li>`,
        )}
      </ol>
    </div>
  </section>`;
}

function publications(ctx) {
  const { site, publications: pubs } = ctx.api;
  const selected = pubs.items.filter((p) => p.featured).slice(0, 5);
  return section({
    en: 'Selected publications',
    zh: '代表性论文',
    aside: html`${more('/publications.html', 'All publications', '全部论文')}
      <p class="note">${t('Recent work appears in', '近期成果发表于')} ${site['site.journals'].slice(0, 6).join(', ')}.</p>`,
    body: html`<ul class="pubs">${selected.map((p) => pubItem(p, ctx))}</ul>`,
  });
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
        'How the rivers on the globe were computed: precipitation minus evapotranspiration from our PML-V2.2 product, routed over elevation. Precipitation: CRU TS 4.09 (Harris et al., 2020). Coastlines, lakes and main river courses: Natural Earth.',
        '地球上的河流由此算得：降水减去本组 PML-V2.2 产品的蒸散发，再沿地形汇流。降水来自 CRU TS 4.09（Harris 等，2020），海岸线、湖泊和主要河道来自 Natural Earth。',
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
    ${budgetSection(ctx)}
    ${publications(ctx)}
    ${data(ctx)}
    ${people(ctx)}
    ${positions(ctx)}`;
  return layout(ctx, { page: 'home', description: `${lab.name_en} group at ${lab.institute_en}. ${lab.tagline_en}`, body, path: '/' });
}
