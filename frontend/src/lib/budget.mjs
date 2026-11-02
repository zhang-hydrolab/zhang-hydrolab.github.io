/**
 * Geometry of the water-budget Sankey. Pure and environment-free, so the static
 * page and the interactive client draw exactly the same picture.
 *
 * Column 1: land precipitation. Column 2: evapotranspiration and river flow.
 * Column 3: land-cover share of ET, and the surface / subsurface split of flow.
 * Column 3 is published for the historical period only, so it fades out as
 * `mix` moves towards the future scenario instead of inventing values.
 */
export function flowValues(budget, mix) {
  const out = {};
  for (const [key, flow] of Object.entries(budget.flows)) {
    const [h, he] = flow.historical;
    const [f, fe] = flow.future ?? flow.historical;
    out[key] = { value: h + (f - h) * mix, error: he + (fe - he) * mix };
  }
  return out;
}

const band = (x0, y0, x1, y1, thickness) => {
  const mid = (x0 + x1) / 2;
  return `M${x0} ${y0}C${mid} ${y0} ${mid} ${y1} ${x1} ${y1}L${x1} ${y1 + thickness}C${mid} ${y1 + thickness} ${mid} ${y0 + thickness} ${x0} ${y0 + thickness}Z`;
};
const spine = (x0, y0, x1, y1) => {
  const mid = (x0 + x1) / 2;
  return `M${x0} ${y0}C${mid} ${y0} ${mid} ${y1} ${x1} ${y1}`;
};

export function budgetLayout(budget, mix, { width, height }) {
  const narrow = width < 640;
  const flows = flowValues(budget, mix);
  const labelRoom = narrow ? 118 : 196;
  const nodeWidth = narrow ? 10 : 14;
  const gap = narrow ? 11 : 9;
  const groupGap = narrow ? 22 : 30;
  const top = 8;
  const steps = budget.et_shares.length + 1;
  const peak = budget.flows.land_precipitation.future?.[0] ?? budget.flows.land_precipitation.historical[0];
  const k = (height - top * 2 - gap * (steps - 1) - groupGap) / peak;

  const detail = Math.max(0, 1 - mix);
  const x0 = 0;
  // With the third column gone, the first ribbons run on to fill the chart,
  // stopping short enough to leave room for their labels.
  const x1Start = Math.round((width - labelRoom) * 0.42);
  const x1End = width - (narrow ? 156 : 206) - nodeWidth;
  const x1 = Math.round(x1Start + (x1End - x1Start) * (1 - detail));
  const x2 = width - labelRoom - nodeWidth;

  const p = flows.land_precipitation.value * k;
  const et = flows.land_et.value * k;
  const q = (flows.land_precipitation.value - flows.land_et.value) * k;

  const links = [];
  const nodes = [];
  const yP = top;
  const yEt = top;
  const yQ = top + et + groupGap;

  nodes.push({ id: 'land_precipitation', x: x0, y: yP, h: p, tone: 'paper' });
  nodes.push({ id: 'land_et', x: x1, y: yEt, h: et, tone: 'green' });
  nodes.push({ id: 'river_flow', x: x1, y: yQ, h: q, tone: 'blue' });

  links.push({ id: 'land_et', tone: 'green', d: band(x0 + nodeWidth, yP, x1, yEt, et), spine: spine(x0 + nodeWidth, yP + et / 2, x1, yEt + et / 2), width: et });
  links.push({ id: 'river_flow', tone: 'blue', d: band(x0 + nodeWidth, yP + et, x1, yQ, q), spine: spine(x0 + nodeWidth, yP + et + q / 2, x1, yQ + q / 2), width: q });

  let yRight = top;
  let ySource = yEt;
  budget.et_shares.forEach((share, i) => {
    const h = (et * share.share) / 100;
    const id = `share_${i}`;
    links.push({ id, tone: 'green', detail: true, d: band(x1 + nodeWidth, ySource, x2, yRight, h), spine: spine(x1 + nodeWidth, ySource + h / 2, x2, yRight + h / 2), width: h });
    nodes.push({ id, x: x2, y: yRight, h, tone: 'green', detail: true });
    ySource += h;
    yRight += h + gap;
  });

  yRight += groupGap - gap;
  const qFlows = [
    ['subsurface_flow', flows.subsurface_flow.value],
    ['surface_flow', flows.surface_flow.value],
  ];
  const qTotal = qFlows.reduce((sum, [, v]) => sum + v, 0);
  ySource = yQ;
  for (const [id, value] of qFlows) {
    const h = (q * value) / qTotal;
    links.push({ id, tone: 'blue', detail: true, d: band(x1 + nodeWidth, ySource, x2, yRight, h), spine: spine(x1 + nodeWidth, ySource + h / 2, x2, yRight + h / 2), width: h });
    nodes.push({ id, x: x2, y: yRight, h, tone: 'blue', detail: true });
    ySource += h;
    yRight += h + gap;
  }

  // Offsets from a node's top edge to its caption and headline number.
  const capY = narrow ? 22 : 30;
  const valueY = narrow ? 54 : 80;
  const inset = narrow ? 8 : 18;
  const labelA = nodeWidth + inset;
  const labelB = x1 + nodeWidth + inset;

  return { width, height, nodeWidth, links, nodes, detail, flows, x1, x2, narrow, capY, valueY, labelA, labelB };
}

const fmt = (n) => n.toFixed(1);

const label = (x, y, cls, id, en, zh) =>
  `<text class="${cls}" x="${x}" y="${y}" data-label="${id}"><tspan class="t-en">${en}</tspan><tspan class="t-zh">${zh}</tspan></text>`;

/** Full SVG markup for one layout. Fragments carry data-* keys the client updates in place. */
export function budgetSvg(budget, layout) {
  const { links, nodes, nodeWidth, flows, narrow, labelA, labelB } = layout;
  const f = budget.flows;
  const nodeOf = (id) => nodes.find((n) => n.id === id);
  const p = nodeOf('land_precipitation');
  const et = nodeOf('land_et');
  const q = nodeOf('river_flow');
  const parts = [];

  parts.push('<g class="bg-links">');
  for (const link of links) {
    const meaning = link.id.startsWith('share_') ? budget.et_shares[Number(link.id.slice(6))].en : budget.flows[link.id].en;
    parts.push(`<path class="link link--${link.tone}${link.detail ? ' is-detail' : ''}" data-link="${link.id}" d="${link.d}" tabindex="0" role="button" aria-label="${meaning}"/>`);
  }
  parts.push('</g><g class="bg-spines" aria-hidden="true">');
  for (const link of links) {
    parts.push(`<path class="spine${link.detail ? ' is-detail' : ''}" data-spine="${link.id}" d="${link.spine}" style="stroke-width:${Math.min(3, Math.max(1.4, link.width / 14))}px"/>`);
  }
  parts.push('</g><g aria-hidden="true">');
  for (const node of nodes) {
    parts.push(`<rect class="node node--${node.tone}${node.detail ? ' is-detail' : ''}" data-node="${node.id}" x="${node.x}" y="${node.y}" width="${nodeWidth}" height="${Math.max(1, node.h)}"/>`);
  }
  parts.push('</g><g class="bg-labels" aria-hidden="true">');

  const big = (x, y, cls, id, value) => `<text class="value ${cls}" x="${x}" y="${y}" data-value="${id}">${value}</text>`;

  // Evapotranspiration's label sits on ribbons that fade out, so its colour
  // follows them (on-detail). The other two sit on ribbons that stay.
  const { capY, valueY } = layout;
  parts.push(big(labelA, p.y + valueY, 'on-green', 'land_precipitation', fmt(flows.land_precipitation.value)));
  parts.push(label(labelA, p.y + capY, 'cap on-green', 'land_precipitation', f.land_precipitation.en, f.land_precipitation.zh));
  parts.push(big(labelB, et.y + valueY, 'on-detail', 'land_et', fmt(flows.land_et.value)));
  parts.push(label(labelB, et.y + capY, 'cap on-detail', 'land_et', f.land_et.en, f.land_et.zh));
  parts.push(big(labelB, q.y + valueY, 'on-blue', 'river_flow', fmt(flows.river_flow.value)));
  parts.push(label(labelB, q.y + capY, 'cap on-blue', 'river_flow', f.river_flow.en, f.river_flow.zh));

  const xLabel = layout.x2 + nodeWidth + (narrow ? 6 : 12);
  budget.et_shares.forEach((share, i) => {
    const node = nodeOf(`share_${i}`);
    const y = node.y + node.h / 2 + 4;
    parts.push(`<text class="row is-detail" x="${xLabel}" y="${y}" data-row="share_${i}"><tspan class="t-en">${share.en}</tspan><tspan class="t-zh">${share.zh}</tspan><tspan class="row__v" dx="6">${share.share}%</tspan></text>`);
  });
  for (const id of ['subsurface_flow', 'surface_flow']) {
    const node = nodeOf(id);
    const y = node.y + node.h / 2 + 4;
    parts.push(`<text class="row is-detail" x="${xLabel}" y="${y}" data-row="${id}"><tspan class="t-en">${f[id].en.replace(' flow', '')}</tspan><tspan class="t-zh">${f[id].zh}</tspan><tspan class="row__v" dx="6">${f[id].historical[0]}</tspan></text>`);
  }
  parts.push('</g>');
  return parts.join('');
}
