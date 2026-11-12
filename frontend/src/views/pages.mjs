import land from '../data/land.json' with { type: 'json' };
import { html, raw, safeHref, t } from '../lib/html.mjs';
import { renderMarkdown } from '../lib/markdown.mjs';
import { coverage } from './charts.mjs';
import { categoryLabel, newsDate, newsHref, newsTarget } from './home.mjs';
import { layout } from './layout.mjs';
import { personLinks } from './person-links.mjs';
import { mapProjector } from '../lib/equal-earth.mjs';
import { byPriority, coauthored } from '../lib/scholarly.mjs';
import { arrow, external, fig, journalMetrics, more, paragraphs, picture, piHonours, pubItem, terrainBlock, themeView } from './parts.mjs';
import { etGlobe, newsRing, pubRing } from './visuals.mjs';

/** A page title, with a terrain block or another visual beside it. */
const pageHead = ({ en, zh, lead, scene, visual = '' }) =>
  html`<header class="pagehead">
    <div class="wrap pagehead__grid">
      <div>
        <p class="kicker"><a href="/">${t('Home', '首页')}</a> / ${t(en, zh)}</p>
        <h1>${t(en, zh)}</h1>
        ${lead ? html`<p class="pagehead__lead">${lead}</p>` : ''}
      </div>
      ${scene ? terrainBlock(scene) : visual}
    </div>
  </header>`;

/* ---------- Research ---------- */

export function researchPage(ctx) {
  const { themes } = ctx.api.research;
  const body = html`
    ${pageHead({
      scene: 'qilian',
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
            ${themeView(theme.id, { cls: 'theme__view', caption: true })}
            ${theme.projects.map(
              (p) => html`<article class="project">
                <h3>${t(p.name, p.name_zh || p.name)}</h3>
                <p>${t(p.description, p.description_zh || p.description)}</p>
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

const TOPIC_ZH = {
  'Vegetation & CO₂': '植被与 CO₂',
  Streamflow: '径流',
  'Remote sensing': '遥感',
  Evapotranspiration: '蒸散发',
  Drought: '干旱',
  'Groundwater & storage': '地下水与水储量',
  'Soil moisture': '土壤水分',
  'Floods & extremes': '洪水与极端事件',
  Prediction: '预测',
  Agriculture: '农业水文',
  'AI & machine learning': '人工智能与机器学习',
};
export const topicLabel = (topic) => t(topic, TOPIC_ZH[topic] ?? topic);

/** What the badges mean and where the numbers come from. */
function badgeKey(ctx) {
  const s = ctx.sch.setting;
  const sample = { jif: 20.6, cas: 1, top: true, cas_field_en: 'Earth Sciences', cas_field_zh: '地球科学' };
  const fake = { sch: { ...ctx.sch, metrics: () => sample } };
  return html`<aside class="badgekey" aria-label="Badge key">
    <ul>
      <li>${journalMetrics(fake, '')}</li>
      <li>${t('Journal impact factor, with a logarithmic meter', '期刊影响因子，条长按对数比例')}</li>
      <li>${t('CAS quartile (major field); Top marks a CAS Top journal', '中科院分区（大类）；Top 表示中科院 Top 期刊')}</li>
    </ul>
    <p class="badgekey__src">${t(s.source_en, s.source_zh)}</p>
  </aside>`;
}

export function publicationsPage(ctx) {
  const { publications } = ctx.api;
  const { sch } = ctx;
  const items = publications.items;
  const flagship = items.filter(sch.isFlagship).sort(byPriority(sch));
  const rest = items.filter((p) => !sch.isFlagship(p));
  const years = [...new Set(items.map((p) => p.year))].sort((a, b) => b - a);
  const scholar = ctx.api.site['site.contact'].links[0].url;
  const q1Count = items.filter((p) => sch.metrics(p.venue)?.cas === 1).length;
  const tiers = (sch.setting.priority ?? []).flat();
  const stat = (value, en, zh) => html`<div><dd>${value}</dd><dt>${t(en, zh)}</dt></div>`;
  const body = html`
    ${pageHead({
      visual: pubRing(ctx),
      en: 'Publications',
      zh: '论文成果',
      lead: html`${t(`${items.length} papers by the group. The full record is on`, `收录团队论文 ${items.length} 篇，完整列表见`)} <a class="link" href="${scholar}" target="_blank" rel="noopener">Google Scholar</a>.`,
    })}
    <section class="wrap pubsummary" aria-label="Summary">
      <dl class="pubstats">
        ${stat(items.length, 'Papers listed', '收录论文')}
        ${stat(flagship.length, 'In Nature, Science and flagship journals', 'Nature、Science 系列及旗舰期刊')}
        ${stat(q1Count, 'In CAS Q1 journals', '中科院 1 区期刊')}
        ${stat(years.length, `Years, ${years.at(-1)}–${years[0]}`, `年（${years.at(-1)}—${years[0]}）`)}
      </dl>
      ${badgeKey(ctx)}
    </section>
    <section class="wrap" data-module="pubfilter">
      <div class="filters">
        <label class="field"><span class="sr-only">Search publications</span>
          <input type="search" data-filter-q placeholder="Search title, author, journal or DOI" data-placeholder-zh="搜索标题、作者、期刊或 DOI" autocomplete="off">
        </label>
        <div class="tags" role="group" aria-label="Show only">
          <button type="button" class="tag tag--key" data-filter-flag="flag" aria-pressed="false">${t('Flagship journals', '旗舰期刊')}</button>
          <button type="button" class="tag tag--key" data-filter-flag="q1" aria-pressed="false">${t('CAS Q1', '中科院 1 区')}</button>
        </div>
        <div class="tags" role="group" aria-label="Filter by topic">
          <button type="button" class="tag is-on" data-filter-topic="" aria-pressed="true">${t('All topics', '全部主题')}</button>
          ${publications.topics.map((x) => html`<button type="button" class="tag" data-filter-topic="${x.topic}" aria-pressed="false">${topicLabel(x.topic)} (${x.count})</button>`)}
        </div>
        <div class="tags" role="group" aria-label="Filter by year">
          ${years.map((y) => html`<button type="button" class="tag" data-filter-year="${y}" aria-pressed="false">${y}</button>`)}
        </div>
        <p class="meta" data-filter-count aria-live="polite"></p>
      </div>
      ${flagship.length
        ? html`<section class="year year--flag" data-year-group="flagship" id="flagship">
            <h2>${t('Flagship journals', '旗舰期刊')}<span class="year__sub">${t(`Nature and Science journals, then ${tiers.slice(-3).join(', ')}`, `Nature、Science 系列，以及 ${tiers.slice(-3).join('、')}`)}</span></h2>
            <ul class="pubs">${flagship.map((p) => pubItem(p, ctx))}</ul>
          </section>`
        : ''}
      ${years.map((year) => {
        const list = rest.filter((p) => p.year === year);
        return list.length
          ? html`<section class="year" data-year-group="${year}">
              <h2>${year}</h2>
              <ul class="pubs">${list.map((p) => pubItem(p, ctx))}</ul>
            </section>`
          : '';
      })}
      <p class="empty" data-filter-empty hidden>${t('No publications match these filters.', '没有符合筛选条件的论文。')}</p>
    </section>`;
  return layout(ctx, { page: 'publications', title: 'Publications', description: 'Searchable list of publications from the Large Scale Hydrology group.', body, path: '/publications.html' });
}

/* ---------- Data ---------- */

export function dataPage(ctx) {
  const { items } = ctx.api.datasets;
  const body = html`
    ${pageHead({
      visual: etGlobe(),
      en: 'Data products',
      zh: '数据产品',
      lead: t('Gridded evapotranspiration, gross primary production and terrestrial water storage products, and a basin-scale water-balance ET benchmark, free to download.', '免费开放的蒸散发、总初级生产力和陆地水储量格点数据产品，以及流域尺度水量平衡蒸散发基准数据。'),
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
  return layout(ctx, { page: 'data', title: 'Data', description: 'Open global and regional evapotranspiration, GPP and terrestrial water storage datasets: PML_v2, PML_v2.2, PML_v2-China, GRACE-Transformer-Gap and ET-WB.', body, path: '/data.html' });
}

/* ---------- Models ---------- */

export function modelsPage(ctx) {
  const { items } = ctx.api.models;
  const body = html`
    ${pageHead({
      visual: etGlobe(),
      en: 'Models',
      zh: '模型产品',
      lead: t('Process models developed by the group, together with their downloadable products.', '课题组发展的过程模型及其可下载产品。'),
    })}
    <section class="wrap">
      <h2 class="minor">${t('Temporal coverage', '时间覆盖')}</h2>
      ${coverage(ctx, items)}
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
  return layout(ctx, { page: 'models', title: 'Models', description: 'Process models from the Large Scale Hydrology group, including the calibration-free complementary relationship evapotranspiration model CR_v3.0.', body, path: '/models.html' });
}

/* ---------- People ---------- */

/** Everyone in the group has the same card, with a medium portrait; alumni are a compact list. */
const GROUP_LAYOUT = { alumni: 'mini' };

const awardIcon = raw(`<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><circle cx="10" cy="7.5" r="5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="m6.6 11.4-1.6 6 5-2.4 5 2.4-1.6-6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>`);

function personTile(ctx, person, { layout = 'row', recognition = null } = {}) {
  const name = [person.honorific, person.name_en].filter(Boolean).join(' ');
  const award = recognition
    ? { en: `${recognition.title_en}${recognition.year ? ` · ${recognition.year}` : ''}`, zh: `${recognition.title_zh}${recognition.year ? ` · ${recognition.year}` : ''}` }
    : null;
  const field = t(person.research_field, person.research_field_zh || person.research_field);
  const search = `${person.name_en} ${person.name_zh} ${person.research_field} ${person.research_field_zh || ''} ${award ? `${award.en} ${award.zh}` : ''}`.toLowerCase();
  const sizes = layout === 'mini' ? '72px' : '(max-width: 560px) 112px, 132px';
  // The other-language name, set small under the main one.
  const second = person.name_zh && person.name_zh !== person.name_en ? t(person.name_zh, person.name_en) : '';
  return html`<li class="person person--${layout}${award ? ' person--award' : ''}" data-search="${search}" id="${recognition ? 'p-talent' : 'p'}-${person.id}">
    ${award ? html`<p class="person__award">${awardIcon}<span>${t(award.en, award.zh)}</span></p>` : ''}
    <button class="person__btn" type="button" data-person aria-haspopup="dialog">
      <span class="person__media">${picture(ctx, person.photo_id, { sizes, alt: '', style: `object-position:${person.photo_focus}` })}</span>
      <span class="person__copy">
        <span class="person__name">${t(person.name_en, person.name_zh || person.name_en)}</span>
        ${second ? html`<span class="person__alt">${second}</span>` : ''}
        <span class="person__field">${field}</span>
      </span>
    </button>${layout === 'mini' ? '' : html`<div class="person__footer">${personLinks(person)}</div>`}
    <div class="person__detail">
      ${picture(ctx, person.photo_id, { sizes: '220px', alt: `Portrait of ${name}`, style: `object-position:${person.photo_focus}` })}
      <div>
        <h3>${t(name, person.name_zh || name)}</h3>${award ? html`<p class="person__recognition">${awardIcon}${t(award.en, award.zh)}</p>` : ''}
        <p class="meta">${field}</p>${person.bio_en || person.bio_zh ? html`<div class="person__bio">${paragraphs((person.bio_en || person.bio_zh).split(/\n\s*\n/), 'en')}${paragraphs((person.bio_zh || person.bio_en).split(/\n\s*\n/), 'zh')}</div>` : ''}${personLinks(person)}
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
  const peopleById = new Map(people.groups.flatMap((g) => g.members).map((p) => [p.id, p]));
  const talents = (site['site.talent'] || []).filter((entry) => peopleById.has(entry.person_id));
  const count = (key) => groups.find((g) => g.key === key)?.members.length ?? 0;
  const composition = [
    ['co_pi', 'Research staff', '科研人员', count('co_pi') + count('assistant')],
    ['postdoc', 'Postdocs', '博士后', count('postdoc')],
    ['phd', 'Ph.D. students', '博士研究生', count('phd')],
    ['master', 'Master students', '硕士研究生', count('master')],
    ['alumni', 'Alumni', '校友', count('alumni')],
  ];
  const layoutOf = (key) => GROUP_LAYOUT[key] ?? 'row';

  const body = html`
    <header class="crew-head">
      <div class="wrap crew-head__grid">
        <div class="crew-head__text">
          <p class="kicker"><a href="/">${t('Home', '首页')}</a> / ${t('People', '团队成员')}</p>
          <h1>${t('People', '团队成员')}</h1>
          <p class="pagehead__lead">${t(
            `${meta.counts.people} researchers and students at the Institute of Geographic Sciences and Natural Resources Research, Chinese Academy of Sciences, in Beijing, and ${meta.counts.alumni} alumni.`,
            `中国科学院地理科学与资源研究所（北京）的 ${meta.counts.people} 位科研人员与研究生，以及 ${meta.counts.alumni} 位校友。`,
          )}</p>
          <ul class="crew-stats">
            ${composition.map(([key, en, zh, n]) => html`<li><a href="#${key}"><b>${n}</b><span>${t(en, zh)}</span></a></li>`)}
          </ul>
        </div>
        <figure class="crew-head__photo">
          ${picture(ctx, assets.group_photo, { sizes: '(max-width: 1000px) 100vw, 640px', alt: 'Group photo at the 2026 graduation ceremony', eager: true })}
          <figcaption>${t('Group photo at the 2026 graduation ceremony.', '2026 年毕业典礼团队合影。')}</figcaption>
        </figure>
      </div>
    </header>
    ${pi
      ? html`<section class="wrap pi" id="pi">
          <div class="pi__side">
            ${picture(ctx, pi.photo_id, { cls: 'pi__photo', sizes: '(max-width: 560px) 120px, (max-width: 760px) 160px, 260px', alt: `Portrait of ${pi.honorific} ${pi.name_en}`, style: `object-position:${pi.photo_focus}` })}
            ${personLinks(pi)}
          </div>
          <div class="pi__text">
            <p class="kicker">${t('Principal Investigator', '团队负责人')}</p>
            <h2>${t(`${pi.honorific} ${pi.name_en}`, `${pi.name_zh}研究员`)}</h2>
            <p class="pi__role">${t(piSetting.title_en, piSetting.title_zh)}</p>
            ${piHonours(ctx, 'pi__honours')}
            ${paragraphs((pi.bio_en || piSetting.bio_en[0]).split(/\n\s*\n/), 'en')}
            ${paragraphs((pi.bio_zh || piSetting.bio_zh[0]).split(/\n\s*\n/), 'zh')}
            <details class="pi__more">
              <summary>${t('More about the group and the principal investigator', '了解更多团队与负责人介绍')}</summary>
              ${paragraphs(piSetting.bio_en, 'en')}
              ${paragraphs(piSetting.bio_zh, 'zh')}
            </details>
            <dl class="pi__stats">${stats.map((s) => html`<div><dd>${s.value.toLocaleString('en-US')}${s.suffix}</dd><dt>${t(s.label_en, s.label_zh)}</dt></div>`)}</dl>
          </div>
        </section>`
      : ''}
    <section class="people-directory" data-module="peoplefilter">
      <div class="crew-bar">
        <div class="wrap crew-bar__inner">
          <label class="field"><span class="sr-only">${t('Search people', '搜索成员')}</span><input type="search" data-people-q placeholder="Search name or research field" data-placeholder-zh="搜索姓名或研究方向" autocomplete="off"></label>
          <div class="tags" role="group" aria-label="Filter by role">
            <button type="button" class="tag is-on" data-people-role="" aria-pressed="true">${t('Everyone', '全部')}</button>
            ${groups.map((g) => html`<button type="button" class="tag" data-people-role="${g.key}" aria-pressed="false">${t(g.label.en, g.label.zh)} <span class="tag__n">${g.members.length}</span></button>`)}
            ${talents.length ? html`<button type="button" class="tag" data-people-role="talent" aria-pressed="false">${t('Talent programmes', '人才计划')} <span class="tag__n">${talents.length}</span></button>` : ''}
          </div>
        </div>
      </div>
      <div class="wrap">
        ${groups.map(
          (g) => html`<section class="group group--${layoutOf(g.key)}" data-group="${g.key}" id="${g.key}">
            <div class="group__heading"><h2>${t(g.label.en, g.label.zh)}</h2><span class="group__count">${g.members.length}</span></div>
            <ul class="people-grid people-grid--${layoutOf(g.key)}">${g.members.map((m) => personTile(ctx, m, { layout: layoutOf(g.key) }))}</ul>
          </section>`,
        )}
        ${talents.length
          ? html`<section class="group group--talent" data-group="talent" id="talent">
              <div class="group__heading"><h2>${t('Talent programmes and grants for young scientists', '人才计划与青年科学基金')}</h2><span class="group__count">${talents.length}</span></div>
              <ul class="people-grid people-grid--row">${talents.map((entry) => personTile(ctx, peopleById.get(entry.person_id), { layout: 'row', recognition: entry }))}</ul>
            </section>`
          : ''}
      </div>
    </section>
    <dialog class="sheet" data-person-dialog aria-labelledby="person-dialog-title">
      <div class="sheet__tools">
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
    ${pageHead({
      visual: newsRing(ctx),
      en: 'News',
      zh: '新闻动态',
      lead: t('Papers, honours, events and news from the group, newest first.', '课题组的论文、荣誉、活动与新闻，按时间由近及远排列。'),
    })}
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
  return layout(ctx, { page: 'news', title: n.title_en || n.title_zh, titleZh: n.title_zh || n.title_en, description: n.summary_en || n.summary_zh || n.title_en || n.title_zh, body, path: `/news/${encodeURIComponent(n.id)}.html`, image: ctx.images[n.cover_id]?.src });
}

/* ---------- Collaboration ---------- */

const CITY_ZH = { Beijing: '北京', Vienna: '维也纳', Potsdam: '波茨坦', Ghent: '根特', 'Richland, WA': '里奇兰', 'Irvine, CA': '尔湾', Canberra: '堪培拉' };
const city = (name) => html`<tspan class="t-en">${name}</tspan><tspan class="t-zh">${CITY_ZH[name] ?? name}</tspan>`;
const cityText = (name) => t(name, CITY_ZH[name] ?? name);

/** Label offsets for crowded cities: [dx, dy, anchor]. */
const LABEL_AT = { Ghent: [-10, 5, 'end'], Potsdam: [0, -12, 'middle'], Vienna: [8, 18, 'start'] };

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

/** A flat world map: Equal Earth, centred on the Pacific, coastlines only. */
function worldMap(ctx) {
  const items = ctx.api.collaborators.items;
  const map = mapProjector(1000, land.centre);
  const f = (n) => n.toFixed(1);
  const ringPath = (pts) => `M${pts.map(([x, y]) => `${f(x)} ${f(y)}`).join('L')}Z`;

  const coast = land.rings
    .map((flat) => {
      const pts = [];
      for (let i = 0; i < flat.length; i += 2) pts.push(map.point(flat[i], flat[i + 1], { shifted: true }));
      return ringPath(pts);
    })
    .join('');

  // The frame of the map and its graticule, every 30 degrees.
  const lats = Array.from({ length: 181 }, (_, i) => i - 90);
  const meridian = (lon) => lats.map((lat) => map.point(lon, lat, { shifted: true }));
  const outline = ringPath([...meridian(land.centre - 180), ...meridian(land.centre + 180).reverse()]);
  const graticule = [];
  for (let d = -150; d <= 150; d += 30) graticule.push(`M${meridian(land.centre + d).map(([x, y]) => `${f(x)} ${f(y)}`).join('L')}`);
  for (let lat = -60; lat <= 60; lat += 30) {
    const [x0, y] = map.point(land.centre - 180, lat, { shifted: true });
    const [x1] = map.point(land.centre + 180, lat, { shifted: true });
    graticule.push(`M${f(x0)} ${f(y)}H${f(x1)}`);
  }

  const home = map.point(HOME.lon, HOME.lat);
  const distance = ([x, y]) => Math.hypot(x - home[0], y - home[1]);
  const points = collaboratorCities(items)
    .map((place) => ({ place, xy: map.point(place.lon, place.lat) }))
    .sort((a, b) => distance(a.xy) - distance(b.xy));

  // Cities close together would stack their labels, so the group fans out:
  // the western one labels to the left, the eastern one below, any between above.
  // Europe's three cities are too close for that and are placed by hand.
  const near = 60;
  const labelFor = ([x, y], name) => {
    const fixed = LABEL_AT[name];
    if (fixed) return { x: x + fixed[0], y: y + fixed[1], anchor: fixed[2] };
    const others = points.map((p) => p.xy).filter(([ox, oy]) => (ox !== x || oy !== y) && Math.abs(ox - x) < near && Math.abs(oy - y) < near);
    const east = others.some(([ox]) => ox > x);
    const west = others.some(([ox]) => ox < x);
    if (east && !west) return { x: x - 9, y: y + 4, anchor: 'end' };
    if (west && !east) return { x: x + 6, y: y + 19, anchor: 'start' };
    return { x, y: y - 11, anchor: 'middle' };
  };

  return html`<svg class="worldmap" viewBox="0 0 ${map.width} ${f(map.height)}" role="group" aria-label="World map with lines linking Beijing to the cities of collaborating institutions">
    <path class="worldmap__sea" d="${outline}"/>
    <path class="worldmap__grid" d="${graticule.join('')}"/>
    <path class="worldmap__land" d="${coast}" fill-rule="evenodd"/>
    <path class="worldmap__frame" d="${outline}"/>
    <g aria-hidden="true">
      ${points.map(({ place, xy }, i) => html`<path class="net__arc" data-place="${place.ids.join(' ')}" d="${arc(home, xy)}" pathLength="1" style="--i:${i}"/>`)}
    </g>
    ${points.map(({ place, xy }, i) => {
      const [x, y] = xy;
      const label = labelFor(xy, place.city);
      return html`<a href="#${place.ids[0]}" aria-label="${place.city}" data-place="${place.ids.join(' ')}"><g class="worldmap__place" style="--i:${i}">
        <circle class="worldmap__halo" cx="${f(x)}" cy="${f(y)}" r="9"/>
        <circle class="worldmap__node" cx="${f(x)}" cy="${f(y)}" r="4"/>
        <text x="${f(label.x)}" y="${f(label.y)}" text-anchor="${label.anchor}">${city(place.city)}</text>
      </g></a>`;
    })}
    <g class="worldmap__home">
      <circle class="worldmap__halo" cx="${f(home[0])}" cy="${f(home[1])}" r="11"/>
      <circle class="worldmap__node" cx="${f(home[0])}" cy="${f(home[1])}" r="5"/>
      <text x="${f(home[0] + 10)}" y="${f(home[1] + 24)}" text-anchor="end">${city('Beijing')}</text>
    </g>
  </svg>`;
}

/** The profile opened from a collaborator's card: biography, photographs and joint papers. */
function collaboratorDetail(ctx, c, papers) {
  const photos = (c.gallery ?? []).filter((id) => ctx.images[id]);
  const surname = c.author_name ? c.author_name.split(',')[0] : c.name.split(' ').at(-1);
  return html`<div class="collab__detail">
    <header class="collab__head">
      ${picture(ctx, c.photo_id, { sizes: '160px', alt: `Portrait of ${c.name}`, style: 'object-position:50% 20%' })}
      <div>
        <h3>${c.name}</h3>
        ${c.title_en ? html`<p class="collab__title">${t(c.title_en, c.title_zh || c.title_en)}</p>` : ''}
        <p class="meta">${t(c.institute, c.institute_zh || c.institute)}${c.city ? html` · ${cityText(c.city)}` : ''}</p>
        ${c.links?.length ? html`<p class="collab__links">${c.links.map((l) => html`<a class="link" href="${safeHref(l.url)}" target="_blank" rel="noopener">${l.label}${external}</a>`)}</p>` : ''}
      </div>
    </header>
    <div class="collab__bio">${paragraphs([c.bio], 'en')}${paragraphs([c.bio_zh || c.bio], 'zh')}</div>
    ${photos.length
      ? html`<section class="collab__gallery">
          <h4>${t('Photographs with the group', '与团队的合影与交流')}</h4>
          <ul>
            ${photos.map((id) => {
              const meta = ctx.mediaById.get(id);
              const caption = t(meta?.alt_en ?? '', meta?.alt_zh || meta?.alt_en || '');
              return html`<li><figure>
                <button class="collab__photo" type="button" data-zoom aria-label="Enlarge: ${meta?.alt_en ?? c.name}">${picture(ctx, id, { sizes: '(max-width: 760px) 50vw, 240px', alt: meta?.alt_en ?? '' })}</button>
                <figcaption>${caption}</figcaption>
              </figure></li>`;
            })}
          </ul>
        </section>`
      : ''}
    <section class="collab__papers">
      <h4>${t(`Co-authored papers (${papers.length})`, `合作论文（${papers.length} 篇）`)}</h4>
      ${papers.length
        ? html`<ul class="pubs">${papers.map((p) => pubItem(p, ctx, { compact: true }))}</ul>
          ${more(`/publications.html?q=${encodeURIComponent(surname)}`, 'Show them in the publication list', '在论文列表中查看')}`
        : html`<p class="note">${t('No joint papers are listed yet.', '暂无收录的合作论文。')}</p>`}
    </section>
  </div>`;
}

export function collaborationPage(ctx) {
  const { items } = ctx.api.collaborators;
  const published = ctx.api.publications.items;
  const body = html`
    ${pageHead({
      en: 'Collaboration',
      zh: '合作网络',
      lead: t('The group works with hydrologists and climate scientists in Europe, North America and Australia. Select a collaborator for a profile and joint papers.', '团队与欧洲、北美和澳大利亚的水文与气候科学家开展合作。点击合作者可查看简介与合作论文。'),
    })}
    <section class="wrap" data-module="collabmap">
      <figure class="plate plate--map">
        ${worldMap(ctx)}
        <figcaption>${t('Lines link Beijing with the cities of collaborating institutions. Equal Earth projection centred on 150° E; coastlines from Natural Earth.', '线条连接北京与合作机构所在城市。等面积 Equal Earth 投影，中央经线 150° E；海岸线来自 Natural Earth。')}</figcaption>
      </figure>
      <ul class="collabs">
        ${items.map((c) => {
          const papers = coauthored(c, published).sort((a, b) => b.year - a.year || (a.sort_order ?? 0) - (b.sort_order ?? 0));
          const photos = (c.gallery ?? []).filter((id) => ctx.images[id]).length;
          return html`<li class="collab" id="${c.id}" data-city="${c.city}">
            <button class="collab__btn" type="button" data-collab aria-haspopup="dialog">
              <span class="collab__portrait">${picture(ctx, c.photo_id, { sizes: '112px', alt: '', style: 'object-position:50% 20%' })}</span>
              <span class="collab__copy">
                <span class="collab__name">${c.name}</span>
                <span class="collab__role">${t(c.title_en || c.institute, c.title_zh || c.institute_zh || c.institute)}</span>
                <span class="meta">${t(c.institute, c.institute_zh || c.institute)}${c.city ? html` · ${cityText(c.city)}` : ''}</span>
                <span class="collab__counts">
                  <span>${t(`${papers.length} joint ${papers.length === 1 ? 'paper' : 'papers'}`, `合作论文 ${papers.length} 篇`)}</span>
                  ${photos ? html`<span>${t(`${photos} ${photos === 1 ? 'photograph' : 'photographs'}`, `合影 ${photos} 张`)}</span>` : ''}
                  <span class="collab__open">${t('Profile', '查看简介')}${arrow}</span>
                </span>
              </span>
            </button>
            ${collaboratorDetail(ctx, c, papers)}
          </li>`;
        })}
      </ul>
    </section>
    <dialog class="sheet sheet--wide" data-collab-dialog aria-labelledby="collab-dialog-title">
      <div class="sheet__tools">
        <button class="tool" type="button" data-dialog-close><span class="sr-only">${t('Close', '关闭')}</span><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m4 4 12 12M16 4 4 16" stroke="currentColor" stroke-width="1.5"/></svg></button>
      </div>
      <div data-collab-slot></div>
    </dialog>`;
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
