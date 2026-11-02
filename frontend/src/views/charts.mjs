import { budgetLayout, budgetSvg } from '../lib/budget.mjs';
import { html, jsonScript, raw, t } from '../lib/html.mjs';

export function budgetSection(ctx, index) {
  const budget = ctx.api.site['site.water_budget'];
  if (!budget) return '';
  const { flows, periods, et_shares: shares, source, warming } = budget;
  const initial = budgetLayout(budget, 0, { width: 1160, height: 620 });
  const scaleKeys = ['ocean_evaporation', 'ocean_precipitation', 'land_precipitation', 'land_et', 'river_flow'];
  const scaleMax = Math.max(...scaleKeys.map((k) => (flows[k].future ?? flows[k].historical)[0]));
  const subsurfaceShare = Math.round((flows.subsurface_flow.historical[0] / flows.river_flow.historical[0]) * 100);
  const crop = shares.find((s) => s.en === 'Cropland');

  return html`<section class="budget plane plane--ink" id="water-budget" data-module="budget">
    <div class="wrap">
      <div class="budget__head">
        <div>
          <p class="eyebrow"><span class="eyebrow__i">/${index}</span>${t('Signature result', '代表性成果')}</p>
          <h2 class="title" data-reveal>${t('Every drop,', '每一滴水，')}<br>${html`<span class="dim">${t('accounted for.', '都有账可查。')}</span>`}</h2>
        </div>
        <div class="budget__intro">
          <p data-reveal>${t(
            'By constraining Earth system models with river-flow observations from 50 large basins, our 2026 Nature Geoscience study redrew the global water budget. Explore it below.',
            '我们 2026 年发表于 Nature Geoscience 的研究利用全球 50 条大型河流的实测径流约束地球系统模型，重新绘制了全球水量收支。您可以在下方亲自探索。',
          )}</p>
          <div class="switch" role="radiogroup" aria-label="Period">
            <button type="button" role="radio" aria-checked="true" data-period="historical"><b>${t(periods.historical.label_en, periods.historical.label_zh)}</b><span>${periods.historical.range}</span></button>
            <button type="button" role="radio" aria-checked="false" data-period="future"><b>${t(periods.future.label_en, periods.future.label_zh)}</b><span>${periods.future.range}</span></button>
          </div>
        </div>
      </div>

      <div class="budget__stage">
        <p class="budget__unit">${t(budget.unit_en, budget.unit_zh)}</p>
        <svg class="budget__svg" data-budget-svg viewBox="0 0 ${initial.width} ${initial.height}" role="group" aria-label="Sankey diagram of the land water budget. Values are listed in the data table below.">${raw(budgetSvg(budget, initial))}</svg>
        <div class="budget__tip" data-budget-tip hidden></div>
        <p class="budget__note" data-budget-note hidden>${t(
          'Land-cover and surface / subsurface splits are published for the historical period only.',
          '土地覆盖与地表/地下径流的分配仅发表了历史时期的结果。',
        )}</p>
      </div>

      <div class="budget__below">
        <div class="scale">
          <h3 class="scale__title">${t('Land against ocean, on one scale', '陆地与海洋，同一标尺')}</h3>
          <ul>
            ${scaleKeys.map((key) => {
              const [value, error] = flows[key].historical;
              return html`<li data-scale="${key}">
                <span class="scale__label">${t(flows[key].en, flows[key].zh)}</span>
                <span class="scale__track"><i class="scale__bar scale__bar--${key.startsWith('land_et') ? 'green' : key.startsWith('river') ? 'blue' : 'paper'}" style="--v:${(value / scaleMax).toFixed(4)}"></i></span>
                <span class="scale__value"><b data-scale-value>${value.toFixed(1)}</b><span>± <span data-scale-error>${error.toFixed(1)}</span></span></span>
              </li>`;
            })}
          </ul>
        </div>
        <ul class="facts">
          <li><b>${subsurfaceShare}%</b><span>${t('of river flow arrives through the subsurface', '的河川流量来自地下径流')}</span></li>
          <li><b>${crop.share}%</b><span>${t('of land evapotranspiration comes from cropland', '的陆地蒸散发来自农田')}</span></li>
          <li><b>+${warming.per_degree[0]}</b><span>${t(`mm of river flow per year for each 1 °C of warming (± ${warming.per_degree[1]})`, `每升温 1 °C，河川流量增加的毫米/年（± ${warming.per_degree[1]}）`)}</span></li>
        </ul>
      </div>

      <details class="budget__table">
        <summary>${t('View the numbers as a table', '以表格查看数据')}</summary>
        <div class="table-scroll"><table>
          <caption>${t(`All fluxes in ${budget.unit_en}, mean ± uncertainty`, `全部通量单位为 ${budget.unit_zh}，均值 ± 不确定性`)}</caption>
          <thead><tr><th scope="col">${t('Flux', '通量')}</th><th scope="col">${t(periods.historical.label_en, periods.historical.label_zh)} (${periods.historical.range})</th><th scope="col">${t(periods.future.label_en, periods.future.label_zh)} (${periods.future.range})</th></tr></thead>
          <tbody>
            ${Object.values(flows).map((f) => html`<tr><th scope="row">${t(f.en, f.zh)}</th><td>${f.historical[0]} ± ${f.historical[1]}</td><td>${f.future ? `${f.future[0]} ± ${f.future[1]}` : '—'}</td></tr>`)}
            ${shares.map((s) => html`<tr><th scope="row">${t(`ET from ${s.en.toLowerCase()}`, `${s.zh}蒸散发占比`)}</th><td>${s.share}% ± ${s.error}%</td><td>—</td></tr>`)}
          </tbody>
        </table></div>
      </details>

      <p class="budget__source">${t('Source:', '来源：')} <a class="link" href="${source.url}" target="_blank" rel="noopener">${source.citation}</a></p>
    </div>
    ${jsonScript('budget-data', budget)}
  </section>`;
}

export function yearBars(ctx, { buttons = false } = {}) {
  const { years } = ctx.api.publications;
  const peak = Math.max(...years.map((y) => y.count));
  return html`<ol class="bars" aria-label="Listed publications per year">
    ${years.map((y) => {
      const isPeak = y.count === peak;
      const inner = html`<span class="bars__v">${y.count}</span><i style="--h:${(y.count / peak).toFixed(3)}"></i><span class="bars__y">${y.year}</span>`;
      const label = `${y.year}: ${y.count} listed publications`;
      return html`<li class="${isPeak ? 'is-peak' : ''}">${
        buttons
          ? html`<button type="button" data-filter-year="${y.year}" aria-pressed="false" aria-label="${label}">${inner}</button>`
          : html`<a href="/publications.html?year=${y.year}" aria-label="${label}">${inner}</a>`
      }</li>`;
    })}
  </ol>`;
}

export function coverage(ctx, { detail = true } = {}) {
  const items = ctx.api.datasets.items.filter((d) => d.start_year);
  const now = new Date().getFullYear();
  const min = 1980;
  const span = now - min;
  const pos = (year) => (((year - min) / span) * 100).toFixed(2);
  const ticks = [1980, 1990, 2000, 2010, 2020].filter((y) => y < now);

  return html`<div class="cov" ${detail ? raw('data-module="coverage"') : ''}>
    <div class="cov__chart">
      <ol class="cov__rows">
        ${items.map((d, i) => {
          const end = d.end_year ?? now;
          return html`<li>
            <button type="button" class="cov__row${i === 0 ? ' is-active' : ''}" data-cov="${d.id}" aria-pressed="${i === 0}">
              <span class="cov__name">${d.name}</span>
              <span class="cov__track"><i class="cov__bar${d.end_year ? '' : ' is-open'}" style="left:${pos(d.start_year)}%;width:${(pos(end) - pos(d.start_year)).toFixed(2)}%"></i></span>
              <span class="cov__range">${d.coverage_label}</span>
            </button>
          </li>`;
        })}
      </ol>
      <div class="cov__axis" aria-hidden="true">
        <span class="cov__name"></span>
        <span class="cov__track">${ticks.map((y) => html`<span style="left:${pos(y)}%">${y}</span>`)}<span class="is-now" style="left:100%">${now}</span></span>
        <span class="cov__range"></span>
      </div>
    </div>
    ${detail
      ? html`<div class="cov__panels">
          ${items.map(
            (d, i) => html`<article class="cov__panel${i === 0 ? ' is-active' : ''}" data-cov-panel="${d.id}">
              <h3>${d.name}</h3>
              <p>${t(d.summary_en, d.summary_zh)}</p>
              <dl class="spec">
                <div><dt>${t('Scope', '范围')}</dt><dd>${d.scope}</dd></div>
                <div><dt>${t('Variables', '变量')}</dt><dd>${d.variables}</dd></div>
                <div><dt>${t('Time step', '时间分辨率')}</dt><dd>${d.temporal}</dd></div>
                <div><dt>${t('Grid', '空间分辨率')}</dt><dd>${d.spatial}</dd></div>
              </dl>
              <a class="link" href="/data.html#${d.id}">${t('Download and cite', '下载与引用')}</a>
            </article>`,
          )}
        </div>`
      : ''}
  </div>`;
}
