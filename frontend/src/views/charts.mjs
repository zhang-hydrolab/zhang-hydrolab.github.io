import { budgetLayout, budgetSvg } from '../lib/budget.mjs';
import { html, jsonScript, raw, t } from '../lib/html.mjs';
import { fig, pauseButton } from './parts.mjs';

/** The water budget explorer. Nested inside the featured study, its heading steps down a level and the study's figure is already shown above it. */
export function budgetSection(ctx, { nested = false } = {}) {
  const budget = ctx.api.site['site.water_budget'];
  if (!budget) return '';
  const { flows, periods, et_shares: shares, source, warming } = budget;
  const initial = budgetLayout(budget, 0, { width: 1160, height: 560 });
  const subsurfaceShare = Math.round((flows.subsurface_flow.historical[0] / flows.river_flow.historical[0]) * 100);
  const crop = shares.find((s) => s.en === 'Cropland');
  const diagram = nested ? null : ctx.api.news.items.find((n) => n.id === '2026-nature-geoscience-water-cycle')?.cover_id;

  // Where each term happens on the block: across, height above the surface, down.
  const labels = [
    ['land_precipitation', [0.26, 0.5, 0.4]],
    ['land_et', [0.56, 0.3, 0.78]],
    ['river_flow', [0.8, 0.03, 0.58]],
    ['ocean_precipitation', [0.9, 0.52, 0.2]],
    ['ocean_evaporation', [0.94, 0.27, 0.82]],
  ];

  return html`<section class="sec sec--budget" id="water-budget" data-module="budget">
    <div class="wrap">
      <div class="sec__grid sec__grid--tight">
        <header class="sec__head">${nested ? html`<h3 class="h2">${t('Global water budget', '全球水量收支')}</h3>` : html`<h2>${t('Global water budget', '全球水量收支')}</h2>`}</header>
        <div class="sec__body">
          <p class="prose-lead">${t(
            'Our 2026 Nature Geoscience study constrained Earth system models with river-flow observations from 50 large basins to quantify the global water budget for the historical period and a future scenario.',
            '我们 2026 年发表于 Nature Geoscience 的研究利用全球 50 条大型河流的实测径流约束地球系统模型，量化了历史时期和未来情景下的全球水量收支。',
          )}</p>
          <div class="switch" role="radiogroup" aria-label="Period">
            <button type="button" role="radio" aria-checked="true" data-period="historical">${t(periods.historical.label_en, periods.historical.label_zh)} <span>${periods.historical.range}</span></button>
            <button type="button" role="radio" aria-checked="false" data-period="future">${t(periods.future.label_en, periods.future.label_zh)} <span>${periods.future.range}</span></button>
          </div>
        </div>
      </div>

      <div class="views" data-views>
        <div class="views__tabs" role="tablist" aria-label="Views of the water budget">
          <button type="button" role="tab" id="tab-block" aria-controls="view-block" aria-selected="true">${t('3D landscape', '三维场景')}</button>
          <button type="button" role="tab" id="tab-flow" aria-controls="view-flow" aria-selected="false" tabindex="-1">${t('Flow diagram', '通量图')}</button>
          <button type="button" role="tab" id="tab-numbers" aria-controls="view-numbers" aria-selected="false" tabindex="-1">${t('Table and findings', '数据与结论')}</button>
        </div>

        <div class="views__panel is-open" id="view-block" role="tabpanel" aria-labelledby="tab-block">
          <figure class="wc" data-module="watercycle">
            <img class="wc__still" src="/earth/water-still.webp" width="1440" height="720" alt="Terrain block from the Tibetan Plateau to the East China Sea, with the Yangtze" loading="lazy" decoding="async">
            <canvas class="wc__canvas" aria-hidden="true"></canvas>
            <ol class="wc__labels">
              ${labels.map(([id, at]) => {
                const flow = flows[id];
                return html`<li data-flux="${id}" data-at="${at.join(',')}">
                  <b data-flux-value>${flow.historical[0]} ± ${flow.historical[1]}</b>
                  <span>${t(flow.en, flow.zh)}</span>
                </li>`;
              })}
            </ol>
            ${pauseButton()}
            <figcaption class="caption">${t(
              html`<b>Figure 1.</b> Global land and ocean fluxes, ${budget.unit_en}, set on a real landscape: the Tibetan Plateau, the Yangtze and the East China Sea. Terrain and rivers are from a 1 km terrain model. The fluxes are global totals and do not describe this region. The amount of rain and vapour follows them when the period changes.`,
              html`<b>图 1</b> 全球陆地与海洋水通量（${budget.unit_zh}），绘于真实地形之上：青藏高原、长江与东海。地形和河网来自 1 km 地形模型。通量为全球总量，并非该地区的数值。切换时期时，雨滴和水汽的数量随之变化。`,
            )}</figcaption>
          </figure>
        </div>

        <div class="views__panel" id="view-flow" role="tabpanel" aria-labelledby="tab-flow">
          <div class="budget__stage">
            <svg class="budget__svg" data-budget-svg viewBox="0 0 ${initial.width} ${initial.height}" role="group" aria-label="Sankey diagram of the land water budget. Values are listed in the table.">${raw(budgetSvg(budget, initial))}</svg>
            <div class="budget__tip" data-budget-tip hidden></div>
          </div>
          <p class="caption">
            ${t(
              html`<b>Figure 2.</b> Land water budget, ${budget.unit_en}. Ribbon width is proportional to flux. Land-cover shares and the surface and subsurface partition were published for the historical period only.`,
              html`<b>图 2</b> 陆地水量收支（${budget.unit_zh}）。条带宽度与通量成正比。土地覆盖占比及地表、地下径流分配仅发表了历史时期的结果。`,
            )}
          </p>
        </div>

        <div class="views__panel" id="view-numbers" role="tabpanel" aria-labelledby="tab-numbers">
          <div class="budget__below">
            <div class="table-scroll"><table class="table table--num">
              <caption>${t(`Table 1. Fluxes in ${budget.unit_en}, mean ± uncertainty.`, `表 1 通量（${budget.unit_zh}），均值 ± 不确定性。`)}</caption>
              <thead><tr><th scope="col">${t('Flux', '通量')}</th><th scope="col">${t(periods.historical.label_en, periods.historical.label_zh)}<br>${periods.historical.range}</th><th scope="col">${t(periods.future.label_en, periods.future.label_zh)}<br>${periods.future.range}</th></tr></thead>
              <tbody>
                ${Object.values(flows).map((f) => html`<tr><th scope="row">${t(f.en, f.zh)}</th><td>${f.historical[0]} ± ${f.historical[1]}</td><td>${f.future ? `${f.future[0]} ± ${f.future[1]}` : '—'}</td></tr>`)}
                ${shares.map((s) => html`<tr><th scope="row">${t(`ET from ${s.en.toLowerCase()}`, `${s.zh}蒸散发占比`)}</th><td>${s.share}% ± ${s.error}%</td><td>—</td></tr>`)}
              </tbody>
            </table></div>
            <div class="findings">
              <h3>${t('Key findings', '主要结论')}</h3>
              <ul>
                <li>${t(`${subsurfaceShare}% of river flow arrives through the subsurface.`, `${subsurfaceShare}% 的河川径流来自地下径流。`)}</li>
                <li>${t(`${crop.share}% of land evapotranspiration comes from cropland.`, `${crop.share}% 的陆地蒸散发来自农田。`)}</li>
                <li>${t(`River flow rises by ${warming.per_degree[0]} ± ${warming.per_degree[1]} mm per year for each 1 °C of warming.`, `每升温 1 °C，河川径流增加 ${warming.per_degree[0]} ± ${warming.per_degree[1]} 毫米/年。`)}</li>
              </ul>
              <p class="note">${t('Source:', '来源：')} <a class="link" href="${source.url}" target="_blank" rel="noopener">${source.citation}</a></p>
              ${diagram
                ? fig(ctx, diagram, {
                    alt: 'Diagram of the global water cycle with fluxes for the historical and future periods',
                    en: 'Figure 3. The global water cycle diagram from the study.',
                    zh: '图 3 该研究更新的全球水循环示意图。',
                    sizes: '(max-width: 1000px) 100vw, 480px',
                  })
                : ''}
            </div>
          </div>
        </div>
      </div>
    </div>
    ${jsonScript('budget-data', budget)}
  </section>`;
}

/** Period of each dataset on one time axis. Static, because the figure is the content. */
export function coverage(ctx, source = ctx.api.datasets.items) {
  const items = source.filter((d) => d.start_year);
  const now = new Date().getFullYear();
  const min = 1980;
  const span = now - min;
  const pos = (year) => (((year - min) / span) * 100).toFixed(2);
  const ticks = [1980, 1990, 2000, 2010, 2020].filter((y) => y < now);

  return html`<figure class="cov">
    <ol class="cov__rows">
      ${items.map((d) => {
        const end = d.end_year ?? now;
        return html`<li>
          <a class="link cov__name" href="#${d.id}">${d.name}</a>
          <span class="cov__track"><i style="left:${pos(d.start_year)}%;width:${(pos(end) - pos(d.start_year)).toFixed(2)}%"></i></span>
          <span class="cov__range">${d.coverage_label}</span>
        </li>`;
      })}
    </ol>
    <div class="cov__axis" aria-hidden="true">
      <span></span>
      <span class="cov__track">${ticks.map((y) => html`<span style="left:${pos(y)}%">${y}</span>`)}</span>
      <span></span>
    </div>
  </figure>`;
}
