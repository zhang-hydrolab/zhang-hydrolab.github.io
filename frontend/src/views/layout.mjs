import { html, raw, safeHref, t } from '../lib/html.mjs';
import { NAV, arrow, mark, picture } from './parts.mjs';

const LANG_BOOT = `(function(){var d=document.documentElement;d.classList.add('js');try{var l=localStorage.getItem('lab-lang');if(l==='zh'){d.dataset.lang='zh';d.lang='zh-CN'}}catch(e){}})();`;

function header(ctx, page) {
  return html`<header class="nav" data-nav>
    <a class="nav__brand" href="/" aria-label="Large Scale Hydrology, home">${mark}<span class="nav__name">${t('Large Scale Hydrology', '大尺度水文学团队')}</span></a>
    <nav class="nav__links" aria-label="Primary">
      ${NAV.map((item) => html`<a href="${item.href}" ${page === item.key ? raw('aria-current="page"') : ''}><span>${t(item.en, item.zh)}</span></a>`)}
    </nav>
    <div class="nav__tools">
      <button class="nav__tool" type="button" data-search-open aria-label="Search the site"><svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="9" cy="9" r="6" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="m14 14 4 4" stroke="currentColor" stroke-width="1.8"/></svg><kbd>Ctrl K</kbd></button>
      <button class="nav__tool nav__lang" type="button" data-lang-toggle aria-label="Switch language: English or Chinese"><span class="t-en">中</span><span class="t-zh">EN</span></button>
      <button class="nav__tool nav__burger" type="button" data-menu-open aria-label="Open menu"><span></span><span></span></button>
    </div>
  </header>`;
}

function menu() {
  return html`<dialog class="menu" data-menu aria-label="Menu">
    <div class="menu__top">
      <span class="eyebrow">${t('Menu', '菜单')}</span>
      <button class="nav__tool" type="button" data-menu-close aria-label="Close menu"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m4 4 12 12M16 4 4 16" stroke="currentColor" stroke-width="1.8"/></svg></button>
    </div>
    <nav aria-label="Mobile">
      <a href="/">${t('Home', '首页')}</a>
      ${NAV.map((item) => html`<a href="${item.href}">${t(item.en, item.zh)}</a>`)}
    </nav>
  </dialog>`;
}

function searchDialog() {
  return html`<dialog class="search" data-search aria-label="Search">
    <form method="dialog" class="search__box">
      <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="9" cy="9" r="6" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="m14 14 4 4" stroke="currentColor" stroke-width="1.8"/></svg>
      <input data-search-input type="search" placeholder="People, papers, datasets, news" aria-label="Search the site" autocomplete="off">
      <button class="search__esc" type="submit" aria-label="Close search">Esc</button>
    </form>
    <ul class="search__results" data-search-results aria-live="polite"></ul>
  </dialog>`;
}

function footer(ctx) {
  const { site, meta } = ctx.api;
  const contact = site['site.contact'];
  const lab = site['site.lab'];
  const logo = site['site.assets']?.logo;
  const updated = meta.updatedAt?.slice(0, 10);
  return html`<footer class="footer">
    <canvas class="footer__water" data-module="dotwave" aria-hidden="true"></canvas>
    <div class="wrap footer__grid">
      <div class="footer__lab">
        ${logo ? picture(ctx, logo, { cls: 'footer__logo', sizes: '96px', alt: 'Large Scale Hydrology research group badge' }) : ''}
        <p>${t(lab.institute_en, lab.institute_zh)}</p>
      </div>
      <div>
        <p class="eyebrow">${t('Find us', '联系方式')}</p>
        <p>${t(contact.address_en, contact.address_zh)}</p>
        <p><a class="link" href="mailto:${contact.email}">${contact.email}</a></p>
      </div>
      <div>
        <p class="eyebrow">${t('Explore', '浏览')}</p>
        <ul class="footer__nav">${NAV.map((item) => html`<li><a class="link" href="${item.href}">${t(item.en, item.zh)}</a></li>`)}</ul>
      </div>
      <div>
        <p class="eyebrow">${t('Elsewhere', '外部链接')}</p>
        <ul class="footer__nav">${contact.links.map((l) => html`<li><a class="link" href="${safeHref(l.url)}" target="_blank" rel="noopener">${l.label}</a></li>`)}
          <li><a class="link" href="/api/v1/meta.json">${t('Open content API', '开放内容接口')}</a></li>
        </ul>
      </div>
    </div>
    <p class="footer__word" aria-hidden="true">Hydrology</p>
    <div class="wrap footer__legal">
      <span>© ${new Date().getFullYear()} ${t(lab.name_en, lab.name_zh)}</span>
      ${updated ? html`<span>${t('Content updated', '内容更新于')} ${updated}</span>` : ''}
      <a class="link" href="#top">${t('Back to top', '返回顶部')} ${arrow}</a>
    </div>
  </footer>`;
}

export function layout(ctx, { page, title, description, nav = 'dark', body, path = '', image }) {
  const lab = ctx.api.site['site.lab'];
  const fullTitle = title ? `${title} · ${lab.name_en}` : `${lab.name_en} · ${lab.institute_short}`;
  const canonical = new URL(path, lab.url).href;
  const cover = image ?? ctx.images[ctx.api.site['site.assets']?.cover]?.src;
  const assets = ctx.assets;
  return `<!doctype html>${html`<html lang="en" data-lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${fullTitle}</title>
<meta name="description" content="${description}">
<link rel="canonical" href="${canonical}">
<meta name="theme-color" content="#1437F5">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${lab.name_en}">
<meta property="og:title" content="${fullTitle}">
<meta property="og:description" content="${description}">
<meta property="og:url" content="${canonical}">
${cover ? html`<meta property="og:image" content="${new URL(cover, lab.url).href}">` : ''}
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<script>${raw(LANG_BOOT)}</script>
${assets.fonts.map((href) => html`<link rel="preload" href="${href}" as="font" type="font/woff2" crossorigin>`)}
<link rel="stylesheet" href="${assets.css}">
<script type="module" src="${assets.js}"></script>
</head>
<body id="top" data-page="${page}" data-nav-tone="${nav}">
<a class="skip" href="#main">Skip to content</a>
${header(ctx, page)}
${menu()}
<main id="main">
${body}
</main>
${footer(ctx)}
${searchDialog()}
<div class="toast" data-toast role="status" aria-live="polite"></div>
<div class="gauge" data-gauge aria-hidden="true"><i></i></div>
</body>
</html>`}`;
}
