/*
 * The publication ring. The marks grow in once; then an arm turns slowly round the record and
 * the centre names the paper under it. Pointing at a mark names that paper instead.
 */
import { bindPause } from '../gl/core.js';

const TURN = 4.2; // Degrees per second: about a minute and a half for the whole record.

export default function pubring(root, { reduceMotion }) {
  const data = JSON.parse(root.querySelector('#ring-data').textContent);
  const marks = [...root.querySelectorAll('.ring__mark')];
  const arm = root.querySelector('[data-ring-arm]');
  const meta = root.querySelector('[data-ring-meta]');
  const title = root.querySelector('[data-ring-title]');
  const svg = root.querySelector('svg');

  let current = -1;
  const show = (i) => {
    if (i === current || !data[i]) return;
    marks[current]?.classList.remove('is-on');
    current = i;
    marks[i].classList.add('is-on');
    meta.textContent = `${data[i].y} · ${data[i].v}`;
    title.textContent = data[i].t;
  };
  show(data.length - 1);

  // The paper whose angle is nearest, by binary search over the sorted angles.
  const nearest = (angle) => {
    let low = 0;
    let high = data.length - 1;
    while (low < high) {
      const mid = (low + high) >> 1;
      if (data[mid].a < angle) low = mid + 1;
      else high = mid;
    }
    return low > 0 && angle - data[low - 1].a < data[low].a - angle ? low - 1 : low;
  };

  let angle = data.at(-1)?.a ?? 0;
  let hovering = false;
  let paused = false;
  let frame = 0;
  let last = 0;
  let onScreen = false;
  const first = data[0]?.a ?? 0;
  const end = data.at(-1)?.a ?? 360;

  const tick = (now) => {
    frame = 0;
    const delta = last ? Math.min(now - last, 50) : 16;
    last = now;
    angle += (TURN * delta) / 1000;
    if (angle > end + 3) angle = first - 3;
    arm.setAttribute('transform', `rotate(${angle.toFixed(2)})`);
    if (!hovering) show(nearest(angle));
    schedule();
  };
  function schedule() {
    if (!frame && onScreen && !paused && !reduceMotion && !document.hidden) frame = requestAnimationFrame(tick);
  }
  const halt = () => {
    cancelAnimationFrame(frame);
    frame = 0;
    last = 0;
  };

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

  svg.addEventListener('pointermove', (event) => {
    const mark = event.target.closest('.ring__mark');
    if (!mark) return;
    hovering = true;
    show(Number(mark.dataset.i));
  });
  svg.addEventListener('pointerleave', () => {
    hovering = false;
  });

  if (reduceMotion) return;

  // Grow the marks out from the inner circle, a year at a time.
  const lengths = marks.map((m) => {
    const x1 = +m.getAttribute('x1');
    const y1 = +m.getAttribute('y1');
    const x2 = +m.getAttribute('x2');
    const y2 = +m.getAttribute('y2');
    return { m, x1, y1, x2, y2 };
  });
  const grow = (start) => (now) => {
    const t = (now - start) / 1400;
    let done = true;
    lengths.forEach(({ m, x1, y1, x2, y2 }, i) => {
      const k = Math.min(1, Math.max(0, t * 1.6 - (i / lengths.length) * 0.6));
      if (k < 1) done = false;
      const e = 1 - (1 - k) ** 3;
      m.setAttribute('x2', (x1 + (x2 - x1) * e).toFixed(1));
      m.setAttribute('y2', (y1 + (y2 - y1) * e).toFixed(1));
    });
    if (!done) requestAnimationFrame(grow(start));
  };
  const seen = new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting) return;
    seen.disconnect();
    requestAnimationFrame((now) => grow(now)(now));
  });
  seen.observe(root);

  bindPause(root, {
    pause(value) {
      paused = value;
      if (paused) halt();
      else schedule();
    },
  }, reduceMotion);
}
