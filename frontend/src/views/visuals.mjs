/*
 * The visuals at the head of the publications, data and news pages. Each is drawn here in full,
 * so the page reads without scripts; a module in client/modules then sets it in motion.
 */
import { html, jsonScript, raw, safeHref, t } from '../lib/html.mjs';
import { categoryLabel, newsDate, newsHref, newsTarget } from './home.mjs';
import { pauseButton, picture } from './parts.mjs';

const f1 = (v) => v.toFixed(1);

/* ---------- Publications: the ring ---------- */

const OPEN = 16; // Degrees left open at the top, where the record starts and ends.
const YEAR_GAP = 1.4; // Space between years, in papers.
const INNER = 176;
const LONGEST = 104;

/** Clockwise from the top, in degrees, to x and y. */
const polar = (degrees, r) => {
  const a = (degrees * Math.PI) / 180;
  return [Math.sin(a) * r, -Math.cos(a) * r];
};

/**
 * Every paper as one mark round a circle, clockwise by year. A mark's length follows the
 * journal impact factor on a log scale and its colour the journal tier.
 */
export function pubRing(ctx) {
  const { sch } = ctx;
  const items = [...ctx.api.publications.items].sort((a, b) => a.year - b.year || (b.sort_order ?? 0) - (a.sort_order ?? 0));
  const years = [...new Set(items.map((p) => p.year))];
  const slots = items.length + (years.length - 1) * YEAR_GAP;
  const step = (360 - OPEN) / slots;
  const top = Math.log10(60);

  let at = 0;
  let year = items[0]?.year;
  const spans = new Map();
  const marks = items.map((p) => {
    if (p.year !== year) {
      at += YEAR_GAP;
      year = p.year;
    }
    const angle = OPEN / 2 + (at + 0.5) * step;
    at += 1;
    const jif = sch.metrics(p.venue)?.jif ?? 0;
    const tier = sch.isFlagship(p) ? 'flag' : sch.metrics(p.venue)?.cas === 1 ? 'q1' : 'other';
    const length = 12 + LONGEST * Math.min(1, Math.max(0, Math.log10(Math.max(jif, 1)) / top));
    const span = spans.get(p.year) ?? [angle, angle];
    spans.set(p.year, [Math.min(span[0], angle), Math.max(span[1], angle)]);
    return { angle, length, tier, p, jif };
  });

  const width = Math.max(1.6, ((2 * Math.PI * INNER) / 360) * step * 0.62);
  const lines = marks.map(({ angle, length, tier }, i) => {
    const [x1, y1] = polar(angle, INNER);
    const [x2, y2] = polar(angle, INNER + length);
    return `<line class="ring__mark ring__mark--${tier}" data-i="${i}" x1="${f1(x1)}" y1="${f1(y1)}" x2="${f1(x2)}" y2="${f1(y2)}" stroke-width="${f1(width)}"/>`;
  });
  // Years on the inside. Where years are crowded, every other one is named.
  const named = years.filter((y, i) => (spans.get(y)[1] - spans.get(y)[0] > 7 ? true : i % 2 === years.length % 2 || y === years.at(-1)));
  const labels = named.map((y) => {
    const [a, b] = spans.get(y);
    const [x, yy] = polar((a + b) / 2, INNER - 16);
    return `<text class="ring__year" x="${f1(x)}" y="${f1(yy + 4)}">${y}</text>`;
  });
  const ticks = [...spans.values()].map(([a, b]) => {
    const p = (deg) => polar(deg, INNER - 5);
    const [x1, y1] = p(a - step * 0.3);
    const [x2, y2] = p(b + step * 0.3);
    const large = b - a > 180 ? 1 : 0;
    return `<path class="ring__span" d="M${f1(x1)} ${f1(y1)}A${INNER - 5} ${INNER - 5} 0 ${large} 1 ${f1(x2)} ${f1(y2)}"/>`;
  });
  const data = marks.map(({ angle, p, jif }) => ({ a: +angle.toFixed(2), y: p.year, v: p.venue, t: p.title, d: p.doi || '', j: jif }));
  const latest = marks.at(-1);

  return html`<figure class="ring" data-module="pubring">
    <div class="ring__stage">
      <svg class="ring__svg" viewBox="-300 -300 600 600" role="img" aria-label="${items.length} papers by year, from ${years[0]} to ${years.at(-1)}. Mark length shows the journal impact factor.">
        <circle class="ring__guide" r="${INNER}"/>
        <circle class="ring__guide ring__guide--faint" r="${INNER + LONGEST / 2}"/>
        <circle class="ring__guide ring__guide--faint" r="${INNER + LONGEST}"/>
        ${raw(ticks.join(''))}
        <g class="ring__marks">${raw(lines.join(''))}</g>
        ${raw(labels.join(''))}
        <line class="ring__arm" data-ring-arm x1="0" y1="${-INNER + 26}" x2="0" y2="${-(INNER + LONGEST + 12)}" transform="rotate(${f1(latest?.angle ?? 0)})"/>
      </svg>
      <div class="ring__centre">
        <p class="ring__count"><b>${items.length}</b> ${t('papers', '篇论文')}</p>
        <p class="ring__now" data-ring-now>
          <span class="meta" data-ring-meta>${latest ? `${latest.p.year} · ${latest.p.venue}` : ''}</span>
          <span class="ring__title" data-ring-title>${latest?.p.title ?? ''}</span>
        </p>
      </div>
      ${pauseButton()}
    </div>
    <figcaption class="ring__key">
      <span><i class="ring__swatch ring__swatch--flag"></i>${t('Flagship journals', '旗舰期刊')}</span>
      <span><i class="ring__swatch ring__swatch--q1"></i>${t('CAS Q1', '中科院 1 区')}</span>
      <span><i class="ring__swatch ring__swatch--other"></i>${t('Other journals', '其他期刊')}</span>
      <span class="ring__note">${t(`Clockwise from ${years[0]}; length is the journal impact factor, log scale`, `自 ${years[0]} 年起顺时针排列；长度为期刊影响因子（对数）`)}</span>
    </figcaption>
    ${jsonScript('ring-data', data)}
  </figure>`;
}

/* ---------- Data: evapotranspiration through the year ---------- */

const MONTHS = [
  ['January', '一月'], ['February', '二月'], ['March', '三月'], ['April', '四月'], ['May', '五月'], ['June', '六月'],
  ['July', '七月'], ['August', '八月'], ['September', '九月'], ['October', '十月'], ['November', '十一月'], ['December', '十二月'],
];

/** A globe of PML-V2.2 evapotranspiration, month by month. The still shows July. */
export function etGlobe() {
  return html`<figure class="etg" data-module="etglobe">
    <div class="etg__stage">
      <img class="etg__still" src="/earth/etglobe-still.webp" width="900" height="900" alt="Globe of mean July evapotranspiration from PML-V2.2, highest over the forests of the Northern Hemisphere" decoding="async" fetchpriority="high">
      <canvas class="etg__canvas" aria-hidden="true"></canvas>
      ${pauseButton()}
    </div>
    <figcaption class="etg__key">
      <p class="etg__month"><b data-etg-month>${t(...MONTHS[6])}</b> <span class="meta">${t('PML-V2.2 evapotranspiration, mean of 2001–2020', 'PML-V2.2 蒸散发，2001–2020 年平均')}</span></p>
      <p class="etg__scale"><span>0</span><i class="etg__ramp" aria-hidden="true"></i><span>${t('150 mm per month', '150 毫米/月')}</span></p>
    </figcaption>
    ${jsonScript('etg-months', MONTHS)}
  </figure>`;
}

/* ---------- News: the ring of the group's latest news ---------- */

const KINDS = ['news', 'publication', 'award', 'event'];
const RING_SIZE = 12;

/** Ticks round the rim of the dial under the ring, one for each card. */
function dial(n) {
  const ticks = Array.from({ length: n }, (_, i) => {
    const a = ((i / n) * 360 * Math.PI) / 180;
    const [x1, y1] = [Math.sin(a) * 88, Math.cos(a) * 88];
    const [x2, y2] = [Math.sin(a) * 96, Math.cos(a) * 96];
    return `<line x1="${f1(x1)}" y1="${f1(y1)}" x2="${f1(x2)}" y2="${f1(y2)}"/>`;
  });
  return `<svg class="nring__dial" viewBox="-100 -100 200 200">
    <defs><radialGradient id="nring-water"><stop offset="0" stop-color="#d9eaf8"/><stop offset="0.7" stop-color="#eaf3fb"/><stop offset="1" stop-color="#f4f9fd" stop-opacity="0"/></radialGradient></defs>
    <circle r="99" fill="url(#nring-water)"/>
    <circle class="nring__rim" r="96"/>
    <circle class="nring__rim nring__rim--inner" r="88"/>
    <circle class="nring__rim nring__rim--faint" r="62"/>
    <g class="nring__ticks">${ticks.join('')}</g>
    <g data-ripples></g>
  </svg>`;
}

/**
 * The latest news as cards on a turning ring, seen from a little above, over a dial of water.
 * The newest is in front; the ring turns towards older items, one card at a time, and the
 * caption names the card in front. Without scripts the newest stays in front.
 */
export function newsRing(ctx) {
  const items = ctx.api.news.items.slice(0, RING_SIZE);
  const n = items.length;
  if (!n) return '';
  const step = 360 / n;
  // Distance from the axis to a card, in card widths, so that neighbours just touch.
  const reach = n > 2 ? 1 / (2 * Math.tan(Math.PI / n)) : 0.6;
  const lead = items[0];
  const kind = (item) => (KINDS.includes(item.category) ? item.category : 'news');

  return html`<figure class="nring" data-module="newsring" style="--n:${n};--step:${step.toFixed(3)}deg;--reach:${reach.toFixed(4)}">
    <div class="nring__stage" data-ring-stage>
      <div class="nring__ring" data-ring>
        <div class="nring__floor" aria-hidden="true">${raw(dial(n))}</div>
        <ol class="nring__cards">
          ${items.map(
            (item, i) => html`<li class="nring__card nring__card--${kind(item)}${i === 0 ? ' is-front' : ''}" style="--i:${i}" data-card>
              <a class="nring__face" href="${safeHref(newsHref(item))}" ${newsTarget(item)}>
                <span class="nring__fig">${picture(ctx, item.cover_id, { sizes: '180px', alt: '' })}</span>
                <span class="nring__meta"><i class="nring__dot nring__dot--${kind(item)}"></i>${newsDate(item)} · ${categoryLabel(item.category)}</span>
                <span class="nring__title">${t(item.title_en, item.title_zh || item.title_en)}</span>
              </a>
              <span class="nring__back" aria-hidden="true"><b>${item.year}</b><span>${categoryLabel(item.category)}</span></span>
            </li>`,
          )}
        </ol>
      </div>
    </div>
    <figcaption class="nring__key">
      <div class="nring__now">
        <p class="meta" data-now-meta><i class="nring__dot nring__dot--${kind(lead)}"></i>${newsDate(lead)} · ${categoryLabel(lead.category)}</p>
        <a class="nring__headline" data-now-title href="${safeHref(newsHref(lead))}" ${newsTarget(lead)}>${t(lead.title_en, lead.title_zh || lead.title_en)}</a>
      </div>
      <div class="nring__tools">
        <button class="nring__turn" type="button" data-turn="-1" aria-label="Newer item"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M12.5 4.5 7 10l5.5 5.5" fill="none" stroke="currentColor" stroke-width="1.6"/></svg></button>
        <span class="nring__count" data-now-count>1 / ${n}</span>
        <button class="nring__turn" type="button" data-turn="1" aria-label="Older item"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M7.5 4.5 13 10l-5.5 5.5" fill="none" stroke="currentColor" stroke-width="1.6"/></svg></button>
        ${pauseButton()}
      </div>
      <p class="nring__legend">${KINDS.map((k) => html`<span><i class="nring__dot nring__dot--${k}"></i>${categoryLabel(k)}</span>`)}</p>
    </figcaption>
  </figure>`;
}
