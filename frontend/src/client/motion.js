/*
 * Entrances for what the reader has not reached yet. Each plays once and leaves no trace.
 *
 * The page is complete without this file. Nothing is hidden until it runs, and then only
 * what is still below the window, so a slow connection never shows a blank page.
 *
 * Images are never faded, because a half-transparent image shows thinned colour. A block
 * holding one stays fully opaque and is uncovered with a clip instead.
 */
const EASE = 'cubic-bezier(.215,.61,.355,1)';
const STAGGER = 70;
const MAX_DELAY = 350;

const BLOCKS = [
  // Home
  '.sec__head',
  '.about__text',
  '.about__photo',
  '.about__more',
  '.metrics > div',
  '.briefs > li',
  '.rows > li',
  '.sky__head',
  '.card',
  '.prose-lead',
  '.switch',
  '.views__tabs',
  '.wc',
  '.budget__stage',
  '.caption',
  '.layers figcaption',
  '.table-scroll',
  '.findings > *',
  '.pi-card',
  '.plate',
  '.positions > div',
  // Inner pages
  '.pubs > li',
  '.year > h2',
  '.newslist > li',
  '.theme > h2',
  '.project > *',
  '.dataset > *',
  '.group__heading',
  '.collab',
].join(', ');

const LINES = '.sec > .wrap';

const options = (duration, delay = 0) => ({ duration, delay, easing: EASE, fill: 'backwards' });

function countUp(el) {
  const target = Number(el.dataset.count);
  const final = el.textContent;
  const suffix = el.dataset.suffix ?? '';
  const started = performance.now();
  const tick = (now) => {
    const t = Math.min(1, (now - started) / 1100);
    if (t === 1) {
      el.textContent = final;
      return;
    }
    const eased = 1 - (1 - t) ** 3;
    el.textContent = `${Math.round(target * eased).toLocaleString('en-US')}${suffix}`;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/** The maps of the data stack begin in one pile and separate into their layers. */
function setupLayers() {
  const stack = document.querySelector('.layers__stack');
  if (!stack) return;
  stack.classList.add('is-closed');
  const observer = new IntersectionObserver(
    ([entry]) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();
      stack.classList.remove('is-closed');
    },
    { rootMargin: '0px 0px -25% 0px' },
  );
  observer.observe(stack);
}

/** A card leans towards the pointer, so it reads as an object and not a printed box. */
function setupTilt() {
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  for (const card of document.querySelectorAll('[data-tilt]')) {
    card.addEventListener('pointermove', (event) => {
      const box = card.getBoundingClientRect();
      card.style.setProperty('--ry', `${(((event.clientX - box.left) / box.width - 0.5) * 7).toFixed(2)}deg`);
      card.style.setProperty('--rx', `${(((event.clientY - box.top) / box.height - 0.5) * -5).toFixed(2)}deg`);
    });
    card.addEventListener('pointerleave', () => {
      card.style.removeProperty('--rx');
      card.style.removeProperty('--ry');
    });
  }
}

function enter(el, delay) {
  if (el.matches(LINES)) {
    el.animate({ transform: ['scaleX(0)', 'scaleX(1)'] }, { ...options(900), pseudoElement: '::before' });
  } else if (el.matches('.budget__stage')) {
    el.animate({ clipPath: ['inset(0 100% 0 0)', 'inset(0 0 0 0)'] }, options(1200));
  } else if (el.matches('.wc')) {
    el.animate({ transform: ['translateY(18px)', 'none'] }, options(800));
  } else if (el.querySelector('img')) {
    el.animate({ clipPath: ['inset(0 0 100% 0)', 'inset(0 0 0 0)'] }, options(800, delay));
  } else {
    el.animate({ opacity: [0, 1], transform: ['translateY(14px)', 'none'] }, options(600, delay));
  }
  const number = el.querySelector('[data-count]');
  if (number) countUp(number);
}

export function setupMotion(reduceMotion) {
  if (reduceMotion || !('IntersectionObserver' in window)) return;
  setupLayers();
  setupTilt();
  const fold = innerHeight;
  const below = (el) => el.getBoundingClientRect().top > fold;

  const all = new Set(document.querySelectorAll(BLOCKS));
  const nested = (el) => {
    for (let up = el.parentElement; up; up = up.parentElement) if (all.has(up)) return true;
    return false;
  };

  const observer = new IntersectionObserver(
    (entries) => {
      entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top || a.boundingClientRect.left - b.boundingClientRect.left)
        .forEach((entry, index) => {
          observer.unobserve(entry.target);
          entry.target.classList.remove('m-wait', 'm-line');
          enter(entry.target, Math.min(index * STAGGER, MAX_DELAY));
        });
    },
    { rootMargin: '0px 0px -5% 0px' },
  );

  for (const el of all) {
    if (nested(el) || !below(el)) continue;
    el.classList.add('m-wait');
    observer.observe(el);
  }
  for (const el of document.querySelectorAll(LINES)) {
    if (!below(el)) continue;
    el.classList.add('m-line');
    observer.observe(el);
  }
}
