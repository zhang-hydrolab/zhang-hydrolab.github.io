/* Runs on every page. Heavier behaviour lives in ./modules and loads on demand. */

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(pointer: fine) and (hover: hover)').matches;

const MODULES = {
  isolines: () => import('./modules/isolines.js'),
  herotype: () => import('./modules/herotype.js'),
  scrollwords: () => import('./modules/scrollwords.js'),
  budget: () => import('./modules/budget.js'),
  panels: () => import('./modules/panels.js'),
  dragscroll: () => import('./modules/dragscroll.js'),
  coverage: () => import('./modules/coverage.js'),
  dotwave: () => import('./modules/dotwave.js'),
  mosaic: () => import('./modules/mosaic.js'),
  pubfilter: () => import('./modules/pubfilter.js'),
  peoplefilter: () => import('./modules/peoplefilter.js'),
  newslist: () => import('./modules/newslist.js'),
  worldmap: () => import('./modules/worldmap.js'),
};

function loadModules() {
  const start = (el) => MODULES[el.dataset.module]?.().then((m) => m.default(el, { reduceMotion, finePointer }));
  const lazy = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        lazy.unobserve(entry.target);
        start(entry.target);
      }
    },
    { rootMargin: '40% 0px' },
  );
  document.querySelectorAll('[data-module]').forEach((el) => lazy.observe(el));
}

function setupLanguage() {
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
      window.dispatchEvent(new CustomEvent('lab:lang', { detail: next }));
    });
  });
}

function setupNav() {
  const nav = document.querySelector('[data-nav]');
  const gauge = document.querySelector('[data-gauge]');
  const firstPlane = document.querySelector('main > :first-child');
  let last = scrollY;
  let ticking = false;

  const update = () => {
    ticking = false;
    const y = scrollY;
    const threshold = (firstPlane?.offsetHeight ?? 400) - 80;
    nav.classList.toggle('is-solid', y > threshold);
    if (Math.abs(y - last) > 6) {
      nav.classList.toggle('is-hidden', y > last && y > 240);
      last = y;
    }
    const max = document.documentElement.scrollHeight - innerHeight;
    gauge?.style.setProperty('--progress', max > 0 ? (y / max).toFixed(4) : 0);
  };

  addEventListener(
    'scroll',
    () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    },
    { passive: true },
  );
  update();

  const menu = document.querySelector('[data-menu]');
  document.querySelector('[data-menu-open]')?.addEventListener('click', () => menu.showModal());
  document.querySelector('[data-menu-close]')?.addEventListener('click', () => menu.close());
}

function setupReveal() {
  const targets = document.querySelectorAll('[data-reveal], .bars, .worldmap');
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);
        entry.target.querySelectorAll?.('[data-count]').forEach(countUp);
        if (entry.target.dataset.count) countUp(entry.target);
      }
    },
    { rootMargin: '0px 0px -8% 0px' },
  );
  targets.forEach((el) => io.observe(el));
}

function countUp(el) {
  if (reduceMotion) return;
  const target = Number(el.dataset.count);
  const suffix = el.dataset.suffix ?? '';
  const started = performance.now();
  const duration = 1500;
  const tick = (now) => {
    const t = Math.min(1, (now - started) / duration);
    const eased = 1 - (1 - t) ** 4;
    el.textContent = `${Math.round(target * eased).toLocaleString('en-US')}${suffix}`;
    if (t < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function setupMarquees() {
  if (reduceMotion) return;
  const tracks = [...document.querySelectorAll('.marquee__track')];
  if (!tracks.length) return;
  let last = scrollY;
  let speed = 1;
  const frame = () => {
    const delta = Math.abs(scrollY - last);
    last = scrollY;
    speed += (1 + Math.min(delta / 8, 7) - speed) * 0.08;
    for (const track of tracks) for (const animation of track.getAnimations()) animation.playbackRate = speed;
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

function setupParallax() {
  if (reduceMotion) return;
  const items = [...document.querySelectorAll('.crew__photo img')];
  if (!items.length) return;
  let ticking = false;
  const update = () => {
    ticking = false;
    for (const img of items) {
      const box = img.parentElement.getBoundingClientRect();
      if (box.bottom < 0 || box.top > innerHeight) continue;
      const progress = (box.top + box.height) / (innerHeight + box.height);
      img.style.transform = `translateY(${(progress - 1) * 15}%)`;
    }
  };
  addEventListener(
    'scroll',
    () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    },
    { passive: true },
  );
  update();
}

function setupMagnetic() {
  if (!finePointer || reduceMotion) return;
  document.querySelectorAll('[data-magnetic]').forEach((el) => {
    el.addEventListener('pointermove', (event) => {
      const box = el.getBoundingClientRect();
      const x = (event.clientX - box.left - box.width / 2) * 0.16;
      const y = (event.clientY - box.top - box.height / 2) * 0.26;
      el.style.transform = `translate(${x}px, ${y}px)`;
    });
    el.addEventListener('pointerleave', () => {
      el.style.transform = '';
    });
  });
}

function setupCursor() {
  if (!finePointer || reduceMotion) return;
  const targets = document.querySelectorAll('[data-cursor]');
  if (!targets.length) return;
  const dot = document.createElement('div');
  dot.className = 'cursor';
  dot.setAttribute('aria-hidden', 'true');
  document.body.append(dot);

  let x = 0;
  let y = 0;
  let cx = 0;
  let cy = 0;
  let scale = 0;
  let want = 0;
  addEventListener('pointermove', (event) => {
    x = event.clientX;
    y = event.clientY;
  }, { passive: true });
  targets.forEach((el) => {
    el.addEventListener('pointerenter', () => {
      dot.textContent = el.dataset.cursor;
      want = 1;
    });
    el.addEventListener('pointerleave', () => {
      want = 0;
    });
  });
  const frame = () => {
    cx += (x - cx) * 0.2;
    cy += (y - cy) * 0.2;
    scale += (want - scale) * 0.18;
    dot.style.transform = `translate(${cx}px, ${cy}px) scale(${scale})`;
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
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
      none.textContent = 'No results';
      list.append(none);
      return;
    }
    for (const { item } of matches) {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = item.url;
      const type = document.createElement('span');
      type.className = 'search__type';
      type.textContent = item.type;
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

setupLanguage();
setupNav();
setupReveal();
setupMarquees();
setupParallax();
setupMagnetic();
setupCursor();
setupCopy();
setupZoom();
setupSearch();
loadModules();
