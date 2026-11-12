import { html, raw, safeHref, t } from '../lib/html.mjs';
import { NAV, picture } from './parts.mjs';

/*
 * One language for the whole site. A visit starts in English. A choice made with the switch, or
 * with ?lang=zh / ?lang=en in a link, is kept in a session cookie, so every page and every tab
 * opened from it follows until the browser is closed. This runs before the page is drawn.
 */
const LANG_BOOT = `(function(){var d=document.documentElement,l=null;d.classList.add('js');try{l=new URLSearchParams(location.search).get('lang')}catch(e){}if(l!=='zh'&&l!=='en'){var m=document.cookie.match(/(?:^|; )lab-lang=(zh|en)/);l=m?m[1]:null}if(!l){try{l=sessionStorage.getItem('lab-lang')}catch(e){}}if(l==='zh'||l==='en'){document.cookie='lab-lang='+l+'; path=/; SameSite=Lax';try{sessionStorage.setItem('lab-lang',l)}catch(e){}}if(l==='zh'){d.dataset.lang='zh';d.lang='zh-CN';if(d.dataset.titleZh)document.title=d.dataset.titleZh}})();`;

const searchIcon = raw(`<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="9" cy="9" r="6" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="m14 14 4 4" stroke="currentColor" stroke-width="1.5"/></svg>`);
const closeIcon = raw(`<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m4 4 12 12M16 4 4 16" stroke="currentColor" stroke-width="1.5"/></svg>`);

function header(ctx, page) {
  const lab = ctx.api.site['site.lab'];
  const logo = ctx.api.site['site.assets']?.logo;
  return html`<header class="nav">
    <div class="wrap nav__inner">
      <a class="nav__brand" href="/" aria-label="${lab.name_en} Group, home">
        ${logo ? picture(ctx, logo, { cls: 'nav__logo', sizes: '48px', alt: '', eager: true }) : ''}
        <span>
          <span class="nav__name">${t(`${lab.name_en} Group`, lab.name_zh)}</span>
          <span class="nav__sub">${t('IGSNRR, Chinese Academy of Sciences', '中国科学院地理科学与资源研究所')}</span>
        </span>
      </a>
      <nav class="nav__links" aria-label="Primary">
        ${NAV.map((item) => html`<a href="${item.href}" ${page === item.key ? raw('aria-current="page"') : ''}>${t(item.en, item.zh)}</a>`)}
      </nav>
      <div class="nav__tools">
        <button class="tool" type="button" data-search-open aria-label="Search the site" title="Search (Ctrl K)">${searchIcon}</button>
        <div class="langswitch" role="group" aria-label="Language / 语言">
          <button type="button" data-lang-set="en" lang="en" aria-pressed="true" title="English">EN</button>
          <button type="button" data-lang-set="zh" lang="zh-CN" aria-pressed="false" title="中文">中文</button>
        </div>
        <button class="tool tool--menu" type="button" data-menu-open aria-label="Open menu"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 6h14M3 10h14M3 14h14" stroke="currentColor" stroke-width="1.5"/></svg></button>
      </div>
    </div>
  </header>`;
}

function menu() {
  return html`<dialog class="menu" data-menu aria-label="Menu">
    <div class="menu__top">
      <span>${t('Menu', '菜单')}</span>
      <button class="tool" type="button" data-menu-close aria-label="Close menu">${closeIcon}</button>
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
      ${searchIcon}
      <input data-search-input type="search" placeholder="People, papers, datasets, models, news" data-placeholder-zh="成员、论文、数据、模型、新闻" aria-label="Search the site" autocomplete="off">
      <button class="search__esc" type="submit" aria-label="Close search">Esc</button>
    </form>
    <ul class="search__results" data-search-results aria-live="polite"></ul>
  </dialog>`;
}

function footer(ctx) {
  const { site, meta } = ctx.api;
  const contact = site['site.contact'];
  const lab = site['site.lab'];
  const updated = meta.updatedAt?.slice(0, 10);
  return html`<footer class="footer">
    <svg class="footer__tide" viewBox="0 0 1440 90" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <path d="M0 58C180 30 300 30 480 50s300 34 480 12 300-42 480-18v46H0Z" fill="#cfe2f1"/>
      <path d="M0 70C220 42 320 44 520 62s280 26 460 8 280-26 460-6v26H0Z" fill="#6da4d0"/>
      <path d="M0 80C200 62 360 62 560 74s300 16 480 4 240-16 400-6v18H0Z" fill="#0a3559"/>
    </svg>
    <div class="footer__sea">
    <div class="wrap footer__grid">
      <div>
        <h2>${t(`${lab.name_en} Group`, lab.name_zh)}</h2>
        <p>${t(lab.institute_en, lab.institute_zh)}</p>
      </div>
      <div>
        <h2>${t('Contact', '联系方式')}</h2>
        <p>${t(contact.address_en, contact.address_zh)}</p>
        <p><a class="link" href="mailto:${contact.email}">${contact.email}</a></p>
      </div>
      <div>
        <h2>${t('Links', '相关链接')}</h2>
        <ul>
          ${contact.links.map((l) => html`<li><a class="link" href="${safeHref(l.url)}" target="_blank" rel="noopener">${l.label}</a></li>`)}
          <li><a class="link" href="/api/v1/meta.json">${t('Open content API', '开放内容接口')}</a></li>
        </ul>
      </div>
    </div>
    <div class="wrap footer__legal">
      <span>© ${new Date().getFullYear()} ${t(`${lab.name_en} Group`, lab.name_zh)}</span>
      ${updated ? html`<span>${t('Content updated', '内容更新于')} ${updated}</span>` : ''}
    </div>
    </div>
  </footer>`;
}

const TITLE_ZH = { ...Object.fromEntries(NAV.map((item) => [item.key, item.zh])), 404: '页面不存在' };

export function layout(ctx, { page, title, titleZh, description, body, path = '', image }) {
  const lab = ctx.api.site['site.lab'];
  const fullTitle = title ? `${title} · ${lab.name_en} Group` : `${lab.name_en} Group · ${lab.institute_short}`;
  const zhName = titleZh ?? (title ? TITLE_ZH[page] : null);
  const fullTitleZh = zhName ? `${zhName} · ${lab.name_zh}` : `${lab.name_zh} · 中国科学院地理科学与资源研究所`;
  const canonical = new URL(path, lab.url).href;
  const cover = image ?? ctx.images[ctx.api.site['site.assets']?.cover]?.src;
  const assets = ctx.assets;
  return `<!doctype html>${html`<html lang="en" data-lang="en" data-title-en="${fullTitle}" data-title-zh="${fullTitleZh}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${fullTitle}</title>
<meta name="description" content="${description}">
<link rel="canonical" href="${canonical}">
<meta name="theme-color" content="#ffffff">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${lab.name_en} Group">
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
<body id="top" data-page="${page}">
<a class="skip" href="#main">Skip to content</a>
${header(ctx, page)}
${menu()}
<main id="main">
${body}
</main>
${footer(ctx)}
${searchDialog()}
<div class="toast" data-toast role="status" aria-live="polite"></div>
</body>
</html>`}`;
}
