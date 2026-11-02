/**
 * A flat raster: the way our data actually looks. Value noise is quantised into
 * five legend classes, like a gridded evapotranspiration map, and drifts slowly.
 * Cells near the pointer step up a class. The left side stays dark for the title.
 */
const LEGEND = ['#06121f', '#0e2233', '#123f8c', '#1437f5', '#c8f031'];
const CELL = 26;

const hash = (x, y) => {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
};

function noise(x, y) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const top = hash(xi, yi) + (hash(xi + 1, yi) - hash(xi, yi)) * u;
  const bottom = hash(xi, yi + 1) + (hash(xi + 1, yi + 1) - hash(xi, yi + 1)) * u;
  return top + (bottom - top) * v;
}

export default function init(canvas, { reduceMotion }) {
  const ctx = canvas.getContext('2d', { alpha: false });
  let cols = 0;
  let rows = 0;
  let scale = 1;
  let cells = new Int8Array(0);
  let visible = true;
  let px = -999;
  let py = -999;
  let last = 0;

  const resize = () => {
    scale = Math.min(devicePixelRatio || 1, 1.5);
    canvas.width = canvas.clientWidth * scale;
    canvas.height = canvas.clientHeight * scale;
    cols = Math.ceil(canvas.clientWidth / CELL);
    rows = Math.ceil(canvas.clientHeight / CELL);
    cells = new Int8Array(cols * rows).fill(-1);
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.fillStyle = LEGEND[0];
    ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
  };

  const draw = (t) => {
    const drift = t / 22000;
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        const n = noise(c * 0.085 + drift, r * 0.11 - drift * 0.6) * 0.72 + noise(c * 0.21 - drift, r * 0.24) * 0.28;
        const fade = Math.min(1, Math.max(0, (c / cols - 0.3) / 0.34));
        const boost = Math.exp(-((c - px) ** 2 + (r - py) ** 2) / 26) * 0.32;
        const value = n * (0.25 + 0.95 * fade) + boost;
        const level = Math.min(LEGEND.length - 1, Math.floor(value * 5.4));
        const i = r * cols + c;
        if (cells[i] === level) continue;
        cells[i] = level;
        ctx.fillStyle = LEGEND[level];
        ctx.fillRect(c * CELL, r * CELL, CELL - 1, CELL - 1);
      }
    }
  };

  resize();
  addEventListener('resize', resize, { passive: true });
  draw(0);
  if (reduceMotion) return;

  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
  }).observe(canvas);

  const host = canvas.parentElement;
  host.addEventListener('pointermove', (event) => {
    const box = canvas.getBoundingClientRect();
    px = (event.clientX - box.left) / CELL;
    py = (event.clientY - box.top) / CELL;
  }, { passive: true });
  host.addEventListener('pointerleave', () => {
    px = -999;
  });

  const frame = (t) => {
    requestAnimationFrame(frame);
    if (!visible || document.hidden || t - last < 50) return;
    last = t;
    draw(t);
  };
  requestAnimationFrame(frame);
}
