/*
 * The ring of the latest news. It turns one card at a time towards older items, and the caption
 * names the card in front. A card can be dragged, clicked or focused to the front; the arrows
 * step through. Ripples spread on the dial beneath. Everything stops off screen, in a hidden tab
 * and on pause; with reduced motion the ring turns only when asked, and without easing.
 */
import { bindPause } from '../gl/core.js';

const DWELL = 3600; // Milliseconds a card stays in front.
const TURN = 1100; // Milliseconds for one turn.
const RIPPLES = 3;
const RIPPLE_TIME = 4200; // Milliseconds for a ripple to cross the dial.
const SVG = 'http://www.w3.org/2000/svg';

const ease = (k) => (k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2);

export default function newsring(root, { reduceMotion }) {
  const stage = root.querySelector('[data-ring-stage]');
  const ring = root.querySelector('[data-ring]');
  const cards = [...root.querySelectorAll('[data-card]')];
  const meta = root.querySelector('[data-now-meta]');
  const title = root.querySelector('[data-now-title]');
  const count = root.querySelector('[data-now-count]');
  const ripples = root.querySelector('[data-ripples]');
  const n = cards.length;
  if (n < 2) return;
  const step = 360 / n;

  let angle = 0; // Degrees the ring has turned; card k is in front at k * step.
  let tween = null;
  let front = 0;
  let idle = 0;
  let paused = false;
  let held = false; // Pointer over the ring, or focus inside it.
  let drag = null;
  let onScreen = false;
  let frame = 0;
  let last = 0;
  let clock = 0;

  const indexAt = (a) => (((Math.round(a / step) % n) + n) % n);

  const place = () => {
    ring.style.setProperty('--turn', `${(-angle).toFixed(3)}deg`);
    const i = indexAt(angle);
    if (i === front) return;
    cards[front].classList.remove('is-front');
    front = i;
    cards[front].classList.add('is-front');
    // The caption copies the card's own two-language markup, so it follows the language switch.
    const card = cards[front];
    const link = card.querySelector('.nring__face');
    meta.innerHTML = card.querySelector('.nring__meta').innerHTML;
    title.innerHTML = card.querySelector('.nring__title').innerHTML;
    title.href = link.getAttribute('href');
    if (link.target) {
      title.target = link.target;
      title.rel = link.rel;
    } else {
      title.removeAttribute('target');
      title.removeAttribute('rel');
    }
    count.textContent = `${front + 1} / ${n}`;
  };

  /** Turns to card k by the shorter way round. */
  const go = (k) => {
    const here = Math.round(angle / step);
    let delta = (((k - here) % n) + n) % n;
    if (delta > n / 2) delta -= n;
    const target = (here + delta) * step;
    idle = 0;
    if (reduceMotion) {
      angle = target;
      tween = null;
      place();
      return;
    }
    tween = { from: angle, to: target, start: performance.now() };
    schedule();
  };

  const moving = () => !reduceMotion && !paused;

  const rings = Array.from({ length: RIPPLES }, () => {
    const circle = document.createElementNS(SVG, 'circle');
    circle.setAttribute('class', 'nring__ripple');
    circle.setAttribute('r', '0');
    ripples?.append(circle);
    return circle;
  });

  const tick = (now) => {
    frame = 0;
    const delta = last ? Math.min(now - last, 50) : 16;
    last = now;
    if (tween) {
      const k = Math.min(1, (now - tween.start) / TURN);
      angle = tween.from + (tween.to - tween.from) * ease(k);
      if (k >= 1) tween = null;
      place();
    } else if (moving() && !held && !drag) {
      idle += delta;
      if (idle > DWELL) go(front + 1);
    }
    if (moving()) {
      clock += delta;
      rings.forEach((circle, i) => {
        const k = (clock / RIPPLE_TIME + i / RIPPLES) % 1;
        circle.setAttribute('r', (8 + k * 86).toFixed(1));
        circle.style.strokeOpacity = ((1 - k) * 0.7).toFixed(3);
      });
    }
    schedule();
  };

  function schedule() {
    if (frame || !onScreen || document.hidden) return;
    if (tween || moving()) frame = requestAnimationFrame(tick);
  }
  const halt = () => {
    cancelAnimationFrame(frame);
    frame = 0;
    last = 0;
  };

  // Stepping, clicking and focusing.
  root.querySelectorAll('[data-turn]').forEach((button) => {
    button.addEventListener('click', () => go(front + Number(button.dataset.turn)));
  });
  cards.forEach((card, k) => {
    card.querySelector('.nring__face').addEventListener('click', (event) => {
      if (drag?.moved || k !== front) {
        event.preventDefault();
        if (!drag?.moved) go(k);
      }
    });
    card.addEventListener('focusin', () => {
      if (k !== front) go(k);
    });
  });

  // Dragging turns the ring; letting go settles on the nearest card.
  stage.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || event.target.closest('[data-pause]')) return;
    tween = null;
    drag = { x: event.clientX, angle, moved: false, id: event.pointerId };
  });
  stage.addEventListener('pointermove', (event) => {
    if (!drag || event.pointerId !== drag.id) return;
    const dx = event.clientX - drag.x;
    if (!drag.moved && Math.abs(dx) > 6) {
      drag.moved = true;
      stage.setPointerCapture(event.pointerId);
      stage.classList.add('is-dragging');
    }
    if (!drag.moved) return;
    const width = cards[0].getBoundingClientRect().width || 140;
    angle = drag.angle - (dx / (width * 1.05)) * step;
    place();
  });
  const release = (event) => {
    if (!drag || event.pointerId !== drag.id) return;
    const { moved } = drag;
    stage.classList.remove('is-dragging');
    if (moved) {
      go(indexAt(angle));
      // Keep the flag for the click that follows a drag, then clear it.
      setTimeout(() => {
        drag = null;
      });
    } else drag = null;
  };
  stage.addEventListener('pointerup', release);
  stage.addEventListener('pointercancel', release);
  // A drag that starts on a card turns the ring, rather than dragging the link away.
  stage.addEventListener('dragstart', (event) => event.preventDefault());

  // Hold still while someone is reading or choosing.
  root.addEventListener('pointerenter', () => {
    held = true;
  });
  root.addEventListener('pointerleave', () => {
    held = false;
    idle = Math.min(idle, DWELL * 0.5);
  });
  root.addEventListener('focusin', () => {
    held = true;
  });
  root.addEventListener('focusout', (event) => {
    if (!root.contains(event.relatedTarget)) held = false;
  });

  new IntersectionObserver(([entry]) => {
    onScreen = entry.isIntersecting;
    if (onScreen) schedule();
    else halt();
  }).observe(root);
  document.addEventListener('visibilitychange', () => {
    last = 0;
    if (document.hidden) halt();
    else schedule();
  });
  bindPause(
    root,
    {
      pause(value) {
        paused = value;
        if (paused && !tween) halt();
        else schedule();
      },
    },
    reduceMotion,
  );
  root.classList.add('is-live');
}
