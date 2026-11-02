/**
 * One-time migration from the 2026 static site into the content database.
 * Run once on 2026-11-01 from the repository root, before the legacy folders
 * were removed. Kept as the record of how each legacy value was mapped and
 * which source errors were corrected. It will not run against the current tree.
 */
import fs from 'node:fs';
import path from 'node:path';
import { loadConfig } from '../../src/config.mjs';
import { Store } from '../../src/store.mjs';

const ROOT = path.resolve(process.argv[2] ?? '.');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8').replaceAll('\r\n', '\n');
const stamp = '2026-11-01T00:00:00.000Z';
const audit = { author: 'legacy-import' };
const problems = [];

const cfg = loadConfig();
const store = Store.open(cfg);
const CJK = /[一-鿿]/;

/* ---------- media ---------- */

const mediaByPath = new Map();
function media(rel, alt_en = '', alt_zh = '') {
  const norm = rel.replace(/\\/g, '/');
  if (mediaByPath.has(norm)) return mediaByPath.get(norm);
  const full = path.join(ROOT, norm);
  if (!fs.existsSync(full)) {
    problems.push(`missing file: ${norm}`);
    return null;
  }
  const row = store.addMedia(fs.readFileSync(full), { filename: path.basename(norm), alt_en, alt_zh }, audit);
  mediaByPath.set(norm, row.id);
  return row.id;
}

const legacyPath = (cell) => cell.match(/\(([^)]*zhangyqlab\\([^)]+))\)/)?.[2]?.replace(/\\/g, '/');

const cells = (line) => line.split('|').slice(1, -1).map((c) => c.trim());
const isRow = (line) => line.startsWith('|') && !/^\|\s*[-:]+\s*\|/.test(line) && !/^\|\s*(photo|research|cover|data)\s*\|/i.test(line);

/* ---------- people ---------- */

const SECTION = [
  [/^Co-PI/i, 'co_pi'],
  [/^PI$/i, 'pi'],
  [/^Postdoc/i, 'postdoc'],
  [/^Ph\.?D/i, 'phd'],
  [/^Master/i, 'master'],
  [/^Research Assistant/i, 'assistant'],
  [/^Visiting/i, 'visiting'],
  [/^Alumni/i, 'alumni'],
];

function linkLabel(url) {
  const host = new URL(url).hostname;
  if (host.includes('scholar.google')) return 'Google Scholar';
  if (host.includes('orcid.org')) return 'ORCID';
  if (host.includes('researchgate')) return 'ResearchGate';
  if (host === 'github.com') return 'GitHub';
  if (host.includes('webofscience')) return 'Web of Science';
  if (host.includes('igsnrr')) return 'IGSNRR';
  return 'Homepage';
}

function parseLinks(cell) {
  const clean = cell.replace(/[‪-‮]/g, ' ');
  const urls = clean.match(/https?:\/\/[^\s)\]]+/g) ?? [];
  return [...new Set(urls.map((u) => u.replace(/Official.*$/, '').replace(/[.,;]+$/, '')))]
    .map((u) => {
      // Corrected: legacy link had a malformed host and path.
      if (u.startsWith('https://scholar.google/citatios')) u = u.replace('https://scholar.google/citatios', 'https://scholar.google.com/citations');
      return { label: linkLabel(u), url: u };
    });
}

let order = 0;
let role = null;
for (const line of read('people/people_list.md').split('\n')) {
  const heading = line.match(/^#\s+(.+)$/)?.[1] ?? line.match(/^\*\*(Research Assistant)\*\*/)?.[1];
  if (heading) {
    role = SECTION.find(([re]) => re.test(heading.trim()))?.[1] ?? role;
    continue;
  }
  if (!isRow(line)) continue;
  const [photo, description, field, link, emailCell] = cells(line);
  const alt = photo.match(/!\[([^\]]*)\]/)?.[1] ?? '';
  const bold = description.match(/\*\*(.+?)\*\*/)?.[1]?.replace(/[,，]+$/, '').trim();
  if (!bold) {
    problems.push(`no name in row: ${line.slice(0, 60)}`);
    continue;
  }
  const honorific = bold.match(/^(Prof\.|Dr\.)/)?.[1] ?? '';
  // Corrected: ORCID, email and paper bylines all spell this name "Xuanze".
  const name_en = bold.replace(/^(Prof\.|Dr\.)\s*/, '').replace('Xuanzhe', 'Xuanze').trim();
  let bio_en = description.replace(/\*\*/g, '').replace('Xuanzhe', 'Xuanze').replace(/\s+/g, ' ').trim();
  if (bio_en === bold || bio_en.replace(/[,，.]/g, '') === bold.replace(/[,，.]/g, '')) bio_en = '';

  let email = emailCell.match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/)?.[0] ?? '';
  if (!email) {
    const inline = bio_en.match(/\s*Email:\s*([\w.+-]+@[\w-]+(?:\.[\w-]+)+)\.?/);
    if (inline) {
      email = inline[1];
      bio_en = bio_en.replace(inline[0], '').trim();
    }
  }

  let links = parseLinks(link);
  // Corrected: this ORCID belongs to Xuanze Zhang (verified on orcid.org).
  if (name_en === 'Jing Tian') links = links.filter((l) => !l.url.includes('0000-0001-8515-5084'));

  const rel = legacyPath(photo);
  const displayName = `${honorific} ${name_en}`.trim();
  const photo_id = rel ? media(rel, `Portrait of ${displayName}`, CJK.test(alt) ? `${alt}的照片` : '') : null;
  if (!photo_id) problems.push(`no photo for ${name_en}`);

  order += 10;
  store.create('people', {
    name_en,
    name_zh: CJK.test(alt) ? alt : '',
    honorific,
    role,
    research_field: field.replace(/，/g, '; ').replace(/；/g, '; ').replace(/\s+/g, ' '),
    bio_en,
    email,
    links,
    photo_id,
    sort_order: order,
    created_at: stamp,
    updated_at: stamp,
  }, audit);
}

/* ---------- publications ---------- */

const TOPICS = [
  ['Evapotranspiration', /evapotranspiration|transpiration|evaporation|\bET\b/i],
  ['Drought', /drought/i],
  ['Floods & extremes', /flood|extreme|bushfire|wildfire|\bfires?\b/i],
  ['Groundwater & storage', /groundwater|GRACE|water storage/i],
  ['Streamflow', /streamflow|runoff|river flow|baseflow/i],
  ['Vegetation & CO₂', /vegetation|CO2|CO₂|greening|ecosystem|GPP|primary production|carbon/i],
  ['AI & machine learning', /machine learning|deep learning|transformer|neural|\bAI\b/i],
  ['Remote sensing', /satellite|remote sensing|MODIS|SMAP|microwave/i],
  ['Agriculture', /crop|maize|agricultur|irrigation/i],
  ['Soil moisture', /soil moisture/i],
  ['Lakes', /\blakes?\b/i],
];
const topicsOf = (title) => TOPICS.filter(([, re]) => re.test(title)).map(([name]) => name);

function parseCitation(raw) {
  const line = raw.replace(/\*/g, '').replace(/\s+/g, ' ').replace(/\bPortico\.\s*/g, '').trim();
  const m = line.match(/^(.+?)\s*\((\d{4})[a-z]?\)\.\s*(.+)$/);
  if (!m) return null;
  const [, authors, year, rest] = m;
  const doiMatch = rest.match(/https?:\/\/(?:dx\.)?doi\.org\/(\S+?)\.?$/);
  const doi = doiMatch ? doiMatch[1].replace(/\.$/, '') : '';
  const urlMatch = doiMatch ? null : rest.match(/(https?:\/\/\S+?)\.?$/);
  const body = rest.replace(/\s*https?:\/\/\S+$/, '').replace(/\.$/, '');
  const parts = body.split(/(?<=[.?!])\s+/);
  let title = body;
  let venueBlock = '';
  if (parts.length > 1) {
    venueBlock = parts.pop();
    title = parts.join(' ');
  }
  title = title.replace(/\.$/, '').trim();
  const vm = venueBlock.match(/^(.+?),\s*(\d+)(?:\((\w+)\))?(?:,\s*(.+))?$/);
  return {
    authors: authors.trim(),
    year: Number(year),
    title,
    venue: (vm ? vm[1] : venueBlock).trim(),
    volume: vm?.[2] ?? '',
    issue: vm?.[3] ?? '',
    pages: vm?.[4]?.trim() ?? '',
    doi,
    url: urlMatch?.[1] ?? '',
  };
}

const FEATURED = [/Overestimation of past and future/i, /Southern Hemisphere dominates/i, /Direct vegetation response to recent CO2/i];
const PDFS = [
  [/Quantifying Global Hydrological Sensitivity/i, 'publications/Zhang 等 - 2024 - Quantifying Global Hydrological Sensitivity to CO2 Physiological and Radiative Forcings U.pdf'],
  [/Direct vegetation response to recent CO2/i, 'publications/Wei 等 - 2024 - Direct vegetation response to recent CO2 rise shows limited effect on global streamflow.pdf'],
  [/Both meteorological droughts and human activities/i, 'publications/Yang 等 - 2024 - Both meteorological droughts and human activities modulated groundwater variations in the northern Y.pdf'],
];

const seenDoi = new Set();
function addPublication(p, sort) {
  if (p.doi) {
    const key = p.doi.toLowerCase();
    if (seenDoi.has(key)) {
      problems.push(`duplicate DOI skipped: ${p.doi} (${p.title.slice(0, 50)})`);
      return;
    }
    seenDoi.add(key);
  }
  const pdf = PDFS.find(([re]) => re.test(p.title));
  store.create('publications', {
    ...p,
    topics: topicsOf(p.title),
    featured: FEATURED.some((re) => re.test(p.title)) ? 1 : 0,
    pdf_id: pdf ? media(pdf[1], p.title) : null,
    sort_order: sort,
    created_at: stamp,
    updated_at: stamp,
  }, audit);
}

// Added: present on the news and data pages but missing from the legacy list.
addPublication({
  authors: 'Zhang, Y., Blöschl, G., Wei, H., Kong, D., Ma, N., Wagener, T., Tian, J., Xia, J., Li, C., Wang, L., Chiew, F. H. S., Leung, L. R., Liu, X., Zheng, H., Zhang, X., & Liu, C.',
  year: 2026,
  title: 'Overestimation of past and future increases in global river flow by Earth system models',
  venue: 'Nature Geoscience',
  doi: '10.1038/s41561-025-01897-9',
}, 10);
addPublication({
  authors: 'Xu, Z., Zhang, Y., Kong, D., Ma, N., & Zhang, X.',
  year: 2026,
  title: 'Extended global terrestrial evapotranspiration and gross primary production dataset from 1982 to near present',
  venue: 'Earth System Science Data Discussions',
  url: 'https://essd.copernicus.org/preprints/essd-2026-94/',
}, 20);

let sort = 0;
const pubSource = read('publications/list.md');
for (const block of pubSource.matchAll(/```\r?\n([\s\S]*?)\r?\n```/g)) {
  const parsed = parseCitation(block[1]);
  sort += 10;
  if (!parsed) {
    problems.push(`unparsed citation: ${block[1].slice(0, 80)}`);
    continue;
  }
  if (!parsed.venue || !parsed.title) problems.push(`weak parse: ${block[1].slice(0, 90)}`);
  addPublication(parsed, sort);
}

/* ---------- research ---------- */

const cleanRef = (s) =>
  s
    .replace(/\[(https?:[^\]]*)\]\(https:\/\/link\.zhihu\.com\/\?target=[^)]*\)/g, '$1')
    .replace('https://doi:10.1016/j.rse.2018.12.031', 'https://doi.org/10.1016/j.rse.2018.12.031')
    .replace(/\*/g, '')
    .replace(/\s*Portico\.\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const splitRefs = (cell) =>
  cell
    .split(/\[\d+\]\s*/)
    .map(cleanRef)
    .filter(Boolean);

const THEMES = [
  {
    match: /Understanding the Changing Global Water Cycle/,
    id: 'water-cycle',
    title_en: 'Water Cycle and Ecohydrology',
    title_zh: '水循环和生态水文',
    heading_en: 'Understanding the Changing Global Water Cycle',
    accent: 'blue',
    image: 'Research/Understanding the Changing Global Water Cycle.png',
    summary_zh:
      '团队研究全球变暖和人类活动如何改变水循环的基本过程，融合卫星、模型（如 PML-V2 蒸散发模型与 HBV-PML 水文模型）和地面观测以更好地量化这些变化，并回答关键问题：为何升温背景下部分水循环过程反而趋于停滞，人类活动又如何在区域和全球尺度上重塑水资源可用性和生态系统功能，例如森林究竟扮演“海绵”还是“水泵”的角色。',
  },
  {
    match: /Water-Related Disasters and Security/,
    id: 'water-security',
    title_en: 'Water-Related Disasters and Security',
    title_zh: '水灾害和水安全',
    heading_en: 'Water-Related Disasters and Security Under Climate Change',
    accent: 'coral',
    image: 'Research/Water-Related Disasters and Security Under Climate Change.png',
    summary_zh:
      '这一方向聚焦干旱和洪水等极端水文事件的机理与影响，研究干旱如何在不同环境圈层中发展和传播，中国洪水格局在数十年间如何演变，以及如何在气候变化下增强社会和生态系统对水相关极端事件的韧性。',
  },
  {
    match: /Innovating Water Science/,
    id: 'water-innovation',
    title_en: 'Innovating Water Science',
    title_zh: '水文水资源与新技术',
    heading_en: 'Innovating Water Science with New Technologies and Models',
    accent: 'lime',
    image: 'Research/Innovating Water Science with New Technologies and Models.png',
    summary_zh:
      '团队利用高分辨率遥感和人工智能等先进技术改进水文过程的监测与预测：研发蒸散发和植被生产力的精细尺度数据集，融合人工智能与物理模型以提升无资料流域的预报能力，并致力于发展实时洪水预报系统，为气候变化下的水资源管理提供支撑。',
  },
];

const PROJECT_NAMES = { 'Forest fire & flood ecological-hydrological effects': 'Forest Fire & Flood Ecological-Hydrological Effects', 'AI for hydrology modeling': 'AI for Hydrology Modeling' };

const researchLines = read('Research/research.md').split('\n');
let theme = null;
let themeIndex = 0;
for (let i = 0; i < researchLines.length; i += 1) {
  const line = researchLines[i];
  if (line.startsWith('# ')) {
    const def = THEMES.find((t) => t.match.test(line));
    if (!def) {
      problems.push(`unknown theme: ${line}`);
      continue;
    }
    const summary_en = researchLines.slice(i + 1).find((l) => l.trim() && !l.startsWith('|'))?.trim().replace(/([^.])$/, '$1.');
    themeIndex += 10;
    theme = store.create('research_themes', {
      id: def.id,
      title_en: def.title_en,
      title_zh: def.title_zh,
      heading_en: def.heading_en,
      summary_en,
      summary_zh: def.summary_zh,
      accent: def.accent,
      image_id: media(def.image, def.title_en, def.title_zh),
      sort_order: themeIndex,
      created_at: stamp,
      updated_at: stamp,
    }, audit);
    continue;
  }
  if (theme && isRow(line)) {
    const [name, photo, description, refs] = cells(line);
    const rel = legacyPath(photo);
    const projectName = PROJECT_NAMES[name] ?? name;
    store.create('research_projects', {
      theme_id: theme.id,
      name: projectName,
      description: description.replace(/\s+/g, ' ').trim(),
      image_id: rel ? media(rel, `${projectName} figure`) : null,
      related: splitRefs(refs ?? ''),
      sort_order: i,
      created_at: stamp,
      updated_at: stamp,
    }, audit);
  }
}

/* ---------- datasets ---------- */

const datasetRefs = Object.fromEntries(
  read('data/data.md').split('\n').filter(isRow).map(cells).map(([name, , , cite, photo]) => [name, { citations: splitRefs(cite), image: legacyPath(photo) }]),
);

const DATASETS = [
  {
    source: 'PML_v2.2',
    name: 'PML_v2.2',
    summary_en: 'Coupled ET and GPP extending PML_v2 back to 1982 by integrating MODIS and AVHRR archives; calibrated at 208 flux stations.',
    summary_zh: '融合 MODIS 与 AVHRR 存档，将 PML_v2 的耦合蒸散发和总初级生产力数据向前延伸至 1982 年，并基于 208 个通量站点率定。',
    scope: 'Global',
    variables: 'ET, GPP',
    temporal: '8-day · half-month',
    spatial: '500 m · 0.1°',
    start_year: 1982,
    end_year: null,
    coverage_label: '1982 – near present',
    downloads: [
      { label: '500 m · Google Earth Engine', url: 'https://developers.google.com/earth-engine/datasets/catalog/projects_pml_evapotranspiration_PML_OUTPUT_PML_V22a' },
      { label: '0.1° · National Tibetan Plateau Data Center', url: 'https://data.tpdc.ac.cn/zh-hans/data/40f57c67-33a6-402d-bd37-6ede91919f23' },
    ],
  },
  {
    source: 'PML_v2',
    name: 'PML_v2',
    summary_en: 'Penman-Monteith-Leuning Evapotranspiration V2: evapotranspiration, its three components, and gross primary production.',
    summary_zh: 'Penman-Monteith-Leuning 蒸散发第二版产品，包含蒸散发及其三个分量和总初级生产力。',
    scope: 'Global',
    variables: 'ET, ET components, GPP',
    temporal: '8-day',
    spatial: '500 m · 0.05°',
    start_year: 2002,
    end_year: null,
    coverage_label: '2002.07 – near present',
    downloads: [
      { label: '500 m · Google Earth Engine', url: 'https://developers.google.cn/earth-engine/datasets/catalog/CAS_IGSNRR_PML_V2_v018' },
      { label: '0.05° · National Tibetan Plateau Data Center', url: 'https://data.tpdc.ac.cn/zh-hans/data/48c16a8d-d307-4973-abab-972e9449627c/' },
    ],
  },
  {
    source: 'PML_v2-china',
    name: 'PML_v2-China',
    summary_en: 'Daily, 500 m coupled evapotranspiration and gross primary production across China.',
    summary_zh: '中国区域逐日、500 米分辨率的耦合蒸散发和总初级生产力数据集。',
    scope: 'China',
    variables: 'ET, GPP',
    temporal: 'Daily',
    spatial: '500 m',
    start_year: 2000,
    end_year: 2020,
    coverage_label: '2000.02.26 – 2020.12.31',
    downloads: [{ label: 'National Tibetan Plateau Data Center', url: 'https://data.tpdc.ac.cn/zh-hans/data/40f57c67-33a6-402d-bd37-6ede91919f23' }],
  },
  {
    source: 'GRACE-transformer-gap',
    name: 'GRACE-Transformer-Gap',
    summary_en: 'Global gap filling of GRACE CSR RL06 terrestrial water storage using a Transformer-based deep learning model.',
    summary_zh: '基于 Transformer 深度学习模型对 GRACE CSR RL06 陆地水储量进行全球空缺填补。',
    scope: 'Global',
    variables: 'Terrestrial water storage',
    temporal: 'Monthly',
    spatial: '0.25°',
    start_year: 2002,
    end_year: null,
    coverage_label: '2002 – near present',
    downloads: [
      { label: 'Single months · figshare', url: 'https://doi.org/10.6084/m9.figshare.24614958' },
      { label: 'Google Drive', url: 'https://drive.google.com/file/d/1l7oQdkEUl-bvoH7OTg9mKlaIybtuscqA/view?usp=drive_link' },
      { label: 'Baidu Netdisk', url: 'https://pan.baidu.com/s/1Zah2ILpn-DTjDG-WimT_TQ?pwd=ancc' },
    ],
  },
];

DATASETS.forEach(({ source, ...d }, i) => {
  const ref = datasetRefs[source];
  if (!ref) problems.push(`dataset source missing: ${source}`);
  store.create('datasets', {
    ...d,
    citations: ref.citations,
    image_id: ref.image ? media(ref.image, `${d.name} figure`) : null,
    sort_order: (i + 1) * 10,
    created_at: stamp,
    updated_at: stamp,
  }, audit);
});

/* ---------- collaborators ---------- */

const PLACES = {
  'Günter Blöschl': ['Vienna', 48.2, 16.37, 'Vienna University of Technology'],
  'Thorsten Wagener': ['Potsdam', 52.4, 13.06, 'University of Potsdam'],
  'Diego Miralles': ['Ghent', 51.05, 3.72, 'Ghent University'],
  'Ruby Leung': ['Richland, WA', 46.28, -119.28, 'Pacific Northwest National Laboratory'],
  'Francis Chiew': ['Canberra', -35.28, 149.13, 'CSIRO'],
  'Tim McVicar': ['Canberra', -35.28, 149.13, 'CSIRO'],
  'Amir AghaKouchak': ['Irvine, CA', 33.64, -117.84, 'University of California, Irvine'],
};

read('colabration/colabration_list.md').split('\n').filter(isRow).forEach((line, i) => {
  const [photo, description] = cells(line);
  const name = description.match(/\*\*(.+?)\*\*/)?.[1];
  const place = PLACES[name];
  if (!place) problems.push(`no place for collaborator: ${name}`);
  const rel = legacyPath(photo);
  store.create('collaborators', {
    name,
    institute: place[3],
    city: place[0],
    lat: place[1],
    lon: place[2],
    bio: description.replace(/\*/g, '').replace(/\s+/g, ' ').trim(),
    photo_id: rel ? media(rel, `Portrait of ${name}`) : null,
    sort_order: (i + 1) * 10,
    created_at: stamp,
    updated_at: stamp,
  }, audit);
});

/* ---------- news ---------- */

const articleText = (file, keep) => {
  const lines = read(file).split('\n').map((l) => l.trim());
  return keep(lines).join('\n\n');
};

const ngBody = articleText('images/news/2026_ng.md', (l) => {
  const pick = (needle) => l.find((x) => x.startsWith(needle));
  return [
    pick('水是地球表层系统'),
    '## 研究内容',
    pick('研究采用“涌现约束”方法'),
    pick('在未来气候变化情景下'),
    '## 发表信息',
    pick('该成果于2026年1月9日'),
    pick('研究获国家自然科学基金'),
    pick('论文信息'),
    `[Read the paper in Nature Geoscience](https://www.nature.com/articles/s41561-025-01897-9)`,
  ];
});

const eurascBody = articleText('images/news/2026_eurasc.md', (l) => {
  const pick = (needle) => l.find((x) => x.startsWith(needle));
  return [
    pick('近日，**中国科学院'),
    '## 关于欧洲科学院',
    pick('欧洲科学院成立于2003年'),
    '## 学术成就与贡献',
    pick('张永强研究员长期致力于'),
    pick('张永强研究员以第一和通讯作者'),
    '## 学院贺信',
    pick('欧洲科学院在官方贺信中'),
  ];
});

const NEWS = [
  {
    id: '2026-eurasc-fellow',
    file: '2026_eurasc',
    year: 2026,
    category: 'award',
    featured: 1,
    title_en: 'Prof. Yongqiang Zhang elected as a Non-European Fellow of EurASc',
    summary_en: 'Elected to the Earth and Environmental Sciences division of the European Academy of Sciences for contributions to evapotranspiration modelling and global water cycle research.',
    summary_zh: '张永强研究员当选欧洲科学院外籍院士，被纳入地球与环境科学学部，表彰其在蒸散发模拟与全球水循环研究领域的系统性、创新性贡献。',
    body_md: eurascBody,
    image: 'images/news/2026_eurasc.png',
    alt: 'Letter from the President of the European Academy of Sciences',
  },
  {
    id: '2026-nature-geoscience-water-cycle',
    file: '2026_ng_water_cycle',
    year: 2026,
    date: '2026-01-09',
    category: 'publication',
    featured: 1,
    title_en: 'Nature Geoscience: quantifying the global water cycle more precisely and updating the classic diagram',
    summary_en: 'Constraining Earth system models with river flow from 50 large basins puts global river flow at 39.1 ± 5.4 × 10³ km³ per year, lower than most earlier estimates.',
    summary_zh: '结合全球 50 条大型河流的实测径流约束地球系统模型，将全球河川流量修正为 39.1 ± 5.4 × 10³ km³/yr，低于以往多数估计。',
    body_md: ngBody,
    image: 'images/news/2026_ng_water_cycle.png',
    alt: 'Updated diagram of the global water cycle with historical and future fluxes',
  },
  {
    id: '2025-wmo-assessment',
    file: '2025WMO',
    year: 2025,
    category: 'news',
    title_en: "Group research supports the WMO's 2024 global water resources assessment",
    image: 'images/news/2025WMO.png',
    alt: 'Cover and map from the WMO State of Global Water Resources 2024 report',
  },
  {
    id: '2025-hydro-geography-committee',
    file: '2025sjz',
    year: 2025,
    category: 'event',
    title_en: 'The whole group takes part in the Hydro-Geography Committee of the Geographical Society of China',
    image: 'images/news/2025sjz.jpg',
    alt: 'Group members at the committee meeting',
  },
  {
    id: '2025-wei-haoshan-honours',
    file: '2025whs',
    year: 2025,
    category: 'award',
    title_en: "Ph.D. student Haoshan Wei receives the National Scholarship, the Dean's Excellence Award and the Liu Changming Scholarship",
    image: 'images/news/2025whs.jpg',
    alt: 'Award announcement for Haoshan Wei',
  },
  {
    id: '2024-nature-communications-co2',
    file: '2024_nc',
    year: 2024,
    category: 'publication',
    featured: 1,
    title_en: 'Nature Communications: Direct vegetation response to recent CO₂ rise shows limited effect on global streamflow',
    image: 'images/news/2024_nc.png',
    alt: 'Figure from the Nature Communications paper',
  },
  {
    id: '2023-science-water-availability',
    file: '2023science',
    year: 2023,
    category: 'publication',
    featured: 1,
    title_en: 'Science: Southern Hemisphere dominates recent decline in global water availability',
    image: 'images/news/2023science.png',
    alt: 'Maps and time series of terrestrial water availability',
  },
  {
    id: '2023-mssanz-medal',
    file: '2023_MSSANZ',
    year: 2023,
    category: 'award',
    featured: 1,
    title_en: 'Prof. Zhang Yongqiang awarded MSSANZ Biennial Medal and elected as Fellow',
    image: 'images/news/2023_MSSANZ.jpg',
    alt: 'MSSANZ medal award',
  },
];

const newsRows = new Map(
  read('images/news/news.md').split('\n').filter(isRow).map(cells).map(([cover, title, link]) => {
    const key = cover.match(/!\[([^\]]+)\]/)?.[1];
    const url = link.match(/https?:\/\/[^\s)]+/)?.[0] ?? '';
    return [key, { title_zh: title, url }];
  }),
);

NEWS.forEach(({ id, file, image, alt, ...n }, i) => {
  const source = newsRows.get(file);
  if (!source) problems.push(`news row missing: ${file}`);
  store.create('news', {
    id,
    ...n,
    title_zh: source.title_zh,
    source_url: source.url,
    cover_id: media(image, alt),
    sort_order: (i + 1) * 10,
    created_at: stamp,
    updated_at: stamp,
  }, audit);
});
media('images/news/2026_ng.png', 'Title page of the 2026 Nature Geoscience paper');

/* ---------- site settings ---------- */

function bio(tag) {
  const html = read('index.html');
  const block = html.match(new RegExp(`<div class="lang-content ${tag}"[^>]*>([\\s\\S]*?)</div>`))[1];
  return [...block.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)].map((m) => m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim());
}

// Refreshed from the group's own 2026 EurASc announcement and the current roster.
const bioEn = bio('lang-en').map((p) =>
  p
    .replace('He also serves as the Deputy Director', 'He is a Non-European Fellow of the European Academy of Sciences (elected 2026) and also serves as the Deputy Director')
    .replace('cited more than 21,000 times, and he has an H-index of 70', 'cited more than 24,000 times, and he has an H-index of 75')
    .replace('for four consecutive years', 'for five consecutive years')
    .replace('totaling nearly 25 members', 'totaling about 30 members'),
);
const bioZh = bio('lang-zh').map((p) =>
  p
    .replace('同时担任陆地水循环', '欧洲科学院外籍院士（2026 年当选），同时担任陆地水循环')
    .replace('已被引用超过21,000次，H指数为70', '已被引用超过24,000次，H指数为75')
    .replace('连续四年', '连续五年')
    .replace('共有近25名成员', '共有约30名成员'),
);

const SETTINGS = {
  'site.lab': {
    name_en: 'Large Scale Hydrology',
    name_zh: '大尺度水文学团队',
    tagline_en: 'We measure, model and forecast how water moves across a changing planet.',
    tagline_zh: '我们观测、模拟并预测水在变化的地球上如何运动。',
    institute_en: 'Institute of Geographic Sciences and Natural Resources Research, Chinese Academy of Sciences',
    institute_zh: '中国科学院地理科学与资源研究所',
    institute_short: 'IGSNRR, CAS',
    statement_en:
      'We investigate how warming and human activity are reshaping the water cycle, and turn satellites, models and AI into open data that anyone can use.',
    statement_zh: '我们研究气候变暖与人类活动如何重塑水循环，并将卫星、模型与人工智能转化为人人可用的开放数据。',
    url: 'https://zhang-hydrolab.github.io/',
  },
  'site.pi': {
    person_id: 'yongqiang-zhang',
    title_en: 'Distinguished Professor, Hydrology and Water Resources',
    title_zh: '二级研究员，水文与水资源',
    bio_en: bioEn,
    bio_zh: bioZh,
  },
  'site.contact': {
    address_en: 'IGSNRR, A937',
    address_zh: '中国科学院地理科学与资源研究所 A937',
    email: 'zhangyq@igsnrr.ac.cn',
    links: [
      { label: 'Google Scholar', url: 'https://scholar.google.com/citations?user=t5iGFeAAAAAJ' },
      { label: 'IGSNRR profile', url: 'https://igsnrr.cas.cn/sourcedb/zw/zjrck/kygg/bjdbgc/201903/t20190327_5262230.html' },
    ],
  },
  'site.stats': [
    { value: 24000, suffix: '+', label_en: 'Citations', label_zh: '谷歌学术引用', source: 'Google Scholar, 2026' },
    { value: 75, suffix: '', label_en: 'H-index', label_zh: 'H 指数', source: 'Google Scholar, 2026' },
    { value: 260, suffix: '', label_en: 'Peer-reviewed papers', label_zh: '同行评审论文', source: 'Group profile' },
    { value: 10, suffix: '', label_en: 'ESI highly cited papers', label_zh: 'ESI 高被引论文', source: 'Group profile' },
  ],
  'site.journals': ['Science', 'Nature Geoscience', 'Nature Water', 'Nature Communications', 'Remote Sensing of Environment', 'Water Resources Research', 'Geophysical Research Letters', 'Earth System Science Data', 'Journal of Hydrology'],
  'site.recruitment': {
    title_en: 'Come work on water.',
    title_zh: '加入我们，研究水。',
    body_en:
      'We are expanding our team now. If you are interested in research topics related to water, climate, hydrology, natural resources and natural disasters, and you also happen to love hydrological modelling, big data analysis, machine learning, data science or simply programming and algorithm development, we have MPhil/PhD Student and Postdoc Researcher positions available in our group.',
    body_zh:
      '我们正在扩充团队。如果你对水、气候、水文学、自然资源与自然灾害等研究主题感兴趣，并且热爱水文模型、大数据分析、机器学习、数据科学或编程算法开发，我们团队长期招收硕士/博士研究生和博士后研究人员。',
    openings: [
      { en: 'MPhil / Ph.D. students', zh: '硕士 / 博士研究生' },
      { en: 'Postdoc researchers', zh: '博士后研究人员' },
    ],
    topics: [
      { en: 'Water, climate and hydrology', zh: '水、气候与水文' },
      { en: 'Natural resources and disasters', zh: '自然资源与自然灾害' },
    ],
    skills: [
      { en: 'Hydrological modelling', zh: '水文模型' },
      { en: 'Big data and machine learning', zh: '大数据与机器学习' },
      { en: 'Programming and algorithms', zh: '编程与算法开发' },
    ],
  },
  // Values read from the published figure in the group's Nature Geoscience paper.
  'site.water_budget': {
    unit_en: '10³ km³ per year',
    unit_zh: '10³ km³/年',
    periods: {
      historical: { label_en: 'Historical', label_zh: '历史时期', range: '1980–2014' },
      future: { label_en: 'Future', label_zh: '未来时期', range: '2051–2100, SSP2-4.5' },
    },
    flows: {
      land_precipitation: { en: 'Land precipitation', zh: '陆地降水', historical: [112.4, 4.2], future: [117.8, 5.3] },
      land_et: { en: 'Land evapotranspiration', zh: '陆地蒸散发', historical: [73.4, 6.2], future: [75.7, 6.5] },
      river_flow: { en: 'Total river flow', zh: '河川总流量', historical: [39.1, 5.4], future: [42.1, 5.7] },
      surface_flow: { en: 'Surface flow', zh: '地表流', historical: [13.2, 3.6], future: null },
      subsurface_flow: { en: 'Subsurface flow', zh: '地下流', historical: [25.9, 5.1], future: null },
      ocean_precipitation: { en: 'Ocean precipitation', zh: '海洋降水', historical: [395.5, 20.6], future: [404.7, 21.7] },
      ocean_evaporation: { en: 'Ocean evaporation', zh: '海洋蒸发', historical: [434.6, 21.3], future: [445.5, 22.9] },
    },
    et_shares: [
      { en: 'Shrubland', zh: '灌丛', share: 31.7, error: 1.2 },
      { en: 'Forest', zh: '森林', share: 29.6, error: 1.9 },
      { en: 'Grassland', zh: '草地', share: 19.0, error: 1.0 },
      { en: 'Cropland', zh: '农田', share: 12.3, error: 0.9 },
      { en: 'Others', zh: '其他', share: 3.9, error: 0.3 },
      { en: 'Wetland', zh: '湿地', share: 1.7, error: 0.3 },
      { en: 'Water', zh: '水体', share: 1.7, error: 0.6 },
    ],
    warming: { per_degree: [7.8, 5.5], unit: 'mm/yr per °C' },
    source: {
      citation: 'Zhang et al. (2026), Nature Geoscience',
      url: 'https://doi.org/10.1038/s41561-025-01897-9',
    },
  },
  'site.assets': {
    logo: media('images/logo.png', 'Large Scale Hydrology research group badge', '大尺度水文学团队徽标'),
    cover: media('images/cover.jpg', 'A wide river valley beneath mountains', '群山之下的宽阔河谷'),
    group_photo: media('images/people/group_people_all_2026.JPG', 'Group photo at the 2026 graduation ceremony', '2026 年毕业典礼团队合影'),
    group_photo_alt: media('images/people/group_people_all.JPG', 'Group photo', '团队合影'),
  },
};
for (const [key, value] of Object.entries(SETTINGS)) store.setSetting(key, value, audit);

// Everything else the old site held stays in the archive, unreferenced but kept.
for (const dir of ['images/people', 'people/photo', 'Research', 'data', 'colabration', 'images/news']) {
  for (const name of fs.readdirSync(path.join(ROOT, dir))) {
    if (/\.(png|jpe?g|webp)$/i.test(name)) media(`${dir}/${name}`);
  }
}

console.log(JSON.stringify(store.status(), null, 2));
console.log(`\n${problems.length} problem(s):`);
for (const p of problems) console.log(` - ${p}`);
store.close();
