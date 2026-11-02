/* Runs on every page. Only behaviour that does a job for the reader lives here. */
import { setupMotion } from './motion.js';

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

const MODULES = {
  budget: () => import('./modules/budget.js'),
  pubfilter: () => import('./modules/pubfilter.js'),
  peoplefilter: () => import('./modules/peoplefilter.js'),
  collabmap: () => import('./modules/collabmap.js'),
  earth: () => import('./modules/earth.js'),
  block: () => import('./modules/block.js'),
  watercycle: () => import('./modules/watercycle.js'),
  swell: () => import('./modules/swell.js'),
  collabglobe: () => import('./modules/collabglobe.js'),
};

function loadModules() {
  // GitHub Pages can be slow to reach, so a press may land before its module has
  // arrived. Remember the last one and repeat it once the module is running.
  const early = new Map();
  document.addEventListener('click', (event) => {
    const host = event.target.closest('[data-module]:not([data-live])');
    const control = event.target.closest('a, button');
    if (host && control && control.tagName !== 'A' && host.contains(control)) early.set(host, control);
  });

  document.querySelectorAll('[data-module]').forEach((el) => {
    MODULES[el.dataset.module]?.()
      .then((m) => m.default(el, { reduceMotion }))
      .then(() => {
        el.dataset.live = '';
        early.get(el)?.click();
        early.delete(el);
      });
  });
}

function syncPlaceholders() {
  const zh = document.documentElement.dataset.lang === 'zh';
  document.querySelectorAll('[data-placeholder-zh]').forEach((input) => {
    input.dataset.placeholderEn ??= input.placeholder;
    input.placeholder = zh ? input.dataset.placeholderZh : input.dataset.placeholderEn;
  });
}

function setupLanguage() {
  syncPlaceholders();
  document.querySelectorAll('[data-lang-toggle]').forEach((button) => {
    button.addEventListener('click', () => {
      const root = document.documentElement;
      const next = root.dataset.lang === 'zh' ? 'en' : 'zh';
      root.dataset.lang = next;
      root.lang = next === 'zh' ? 'zh-CN' : 'en';
      try {
        localStorage.setItem('lab-lang', next);
      } catch {
        /* Private mode: the choice just lasts for this page. */
      }
      syncPlaceholders();
      window.dispatchEvent(new CustomEvent('lab:lang', { detail: next }));
    });
  });
}

/** Marks the theme being read in the contents list. */
function setupContents() {
  const links = new Map([...document.querySelectorAll('.toc a')].map((a) => [a.hash.slice(1), a]));
  if (!links.size) return;
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        links.forEach((a) => a.removeAttribute('aria-current'));
        links.get(entry.target.id)?.setAttribute('aria-current', 'true');
      }
    },
    { rootMargin: '-30% 0px -65% 0px' },
  );
  for (const id of links.keys()) {
    const section = document.getElementById(id);
    if (section) observer.observe(section);
  }
}

function setupMenu() {
  const menu = document.querySelector('[data-menu]');
  document.querySelector('[data-menu-open]')?.addEventListener('click', () => menu.showModal());
  document.querySelector('[data-menu-close]')?.addEventListener('click', () => menu.close());
}

export function toast(message) {
  const el = document.querySelector('[data-toast]');
  if (!el) return;
  el.textContent = message;
  el.classList.add('is-on');
  clearTimeout(el.timer);
  el.timer = setTimeout(() => el.classList.remove('is-on'), 1800);
}

function setupCopy() {
  document.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-copy]');
    if (!button) return;
    const zh = document.documentElement.dataset.lang === 'zh';
    try {
      await navigator.clipboard.writeText(button.dataset.copy);
      toast(zh ? '已复制' : 'Copied');
    } catch {
      toast(zh ? '无法复制' : 'Copy failed');
    }
  });
}

function setupZoom() {
  let dialog;
  document.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-zoom]');
    if (!trigger) return;
    const source = trigger.querySelector('img');
    if (!dialog) {
      dialog = document.createElement('dialog');
      dialog.className = 'zoom';
      dialog.setAttribute('aria-label', 'Enlarged image');
      dialog.addEventListener('click', () => dialog.close());
      document.body.append(dialog);
    }
    const image = new Image();
    image.src = source.src;
    image.alt = source.alt;
    dialog.replaceChildren(image);
    dialog.showModal();
  });
}

const SEARCH_TYPES_ZH = { Person: '成员', Paper: '论文', Dataset: '数据', News: '新闻', Research: '研究', Collaborator: '合作者' };

function setupSearch() {
  // Scoped to the tag: publication and person cards also carry data-search text.
  const dialog = document.querySelector('dialog[data-search]');
  const input = dialog.querySelector('[data-search-input]');
  const list = dialog.querySelector('[data-search-results]');
  let index = null;
  let active = -1;

  const links = () => [...list.querySelectorAll('a')];
  const highlight = (i) => {
    const items = links();
    items.forEach((a) => a.classList.remove('is-active'));
    active = items.length ? (i + items.length) % items.length : -1;
    if (active >= 0) {
      items[active].classList.add('is-active');
      items[active].scrollIntoView({ block: 'nearest' });
    }
  };

  const search = () => {
    const query = input.value.trim().toLowerCase();
    list.replaceChildren();
    active = -1;
    if (!query || !index) return;
    const zh = document.documentElement.dataset.lang === 'zh';
    const words = query.split(/\s+/);
    const matches = index
      .filter((item) => words.every((w) => item.text.includes(w)))
      .map((item) => {
        const title = item.title.toLowerCase();
        return { item, score: (title.startsWith(query) ? 3 : 0) + (title.includes(query) ? 2 : 0) + (item.type === 'Person' ? 0.5 : 0) };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 12);

    if (!matches.length) {
      const none = document.createElement('li');
      none.className = 'search__none';
      none.textContent = zh ? '没有结果' : 'No results';
      list.append(none);
      return;
    }
    for (const { item } of matches) {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = item.url;
      const type = document.createElement('span');
      type.className = 'search__type';
      type.textContent = zh ? SEARCH_TYPES_ZH[item.type] : item.type;
      const title = document.createElement('span');
      title.className = 'search__title';
      title.textContent = item.title;
      const sub = document.createElement('span');
      sub.className = 'search__sub';
      sub.textContent = item.sub;
      a.append(type, title, sub);
      li.append(a);
      list.append(li);
    }
    highlight(0);
  };

  const open = async () => {
    dialog.showModal();
    input.focus();
    if (!index) {
      const response = await fetch('/assets/search-index.json');
      index = await response.json();
      search();
    }
  };

  document.querySelectorAll('[data-search-open]').forEach((b) => b.addEventListener('click', open));
  input.addEventListener('input', search);
  input.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      highlight(active + 1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      highlight(active - 1);
    } else if (event.key === 'Enter') {
      const target = links()[active];
      if (target) {
        event.preventDefault();
        target.click();
      }
    } else if (event.key === 'Escape') {
      // A search input would otherwise spend Escape on clearing its own text.
      event.preventDefault();
      dialog.close();
    }
  });
  list.addEventListener('click', (event) => {
    if (event.target.closest('a')) dialog.close();
  });
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
  addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      if (dialog.open) dialog.close();
      else open();
    }
  });
}

setupMotion(reduceMotion);
setupLanguage();
setupContents();
setupMenu();
setupCopy();
setupZoom();
setupSearch();
loadModules();
