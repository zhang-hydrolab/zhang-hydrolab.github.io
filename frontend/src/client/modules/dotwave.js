/** Footer sea level drawn as a dot matrix. The pointer raises a swell. */
const CELL = 13;

export default function init(canvas, { reduceMotion }) {
  const ctx = canvas.getContext('2d');
  let cols = 0;
  let rows = 0;
  let scale = 1;
  let visible = true;
  let px = -1000;
  let presence = 0;
  let want = 0;
  let last = 0;

  const resize = () => {
    scale = Math.min(devicePixelRatio || 1, 2);
    canvas.width = canvas.clientWidth * scale;
    canvas.height = canvas.clientHeight * scale;
    cols = Math.ceil(canvas.clientWidth / CELL) + 1;
    rows = Math.ceil(canvas.clientHeight / CELL) + 1;
  };

  const draw = (t) => {
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    const seconds = t / 1000;
    const height = canvas.clientHeight;
    const lime = [];
    const blue = [];
    for (let c = 0; c < cols; c += 1) {
      const x = c * CELL;
      const swell = Math.exp(-(((x - px) / 150) ** 2)) * presence * 46;
      const level =
        height * 0.52 +
        Math.sin(c * 0.13 + seconds * 0.9) * 13 +
        Math.sin(c * 0.051 - seconds * 0.55) * 21 -
        swell;
      for (let r = 0; r < rows; r += 1) {
        const y = r * CELL;
        const depth = y - level;
        if (depth < 0) continue;
        (depth < CELL * 1.3 ? lime : blue).push(x, y, Math.max(1.1, 4.4 - depth / 26));
      }
    }
    const paint = (points, color) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      for (let i = 0; i < points.length; i += 3) {
        ctx.moveTo(points[i] + points[i + 2], points[i + 1]);
        ctx.arc(points[i], points[i + 1], points[i + 2], 0, 6.2832);
      }
      ctx.fill();
    };
    paint(blue, '#1437f5');
    paint(lime, '#c8f031');
  };

  resize();
  addEventListener('resize', resize, { passive: true });

  if (reduceMotion) {
    draw(0);
    return;
  }

  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
  }).observe(canvas);

  const host = canvas.parentElement;
  host.addEventListener('pointermove', (event) => {
    px = event.clientX - canvas.getBoundingClientRect().left;
    want = 1;
  }, { passive: true });
  host.addEventListener('pointerleave', () => {
    want = 0;
  });

  const frame = (t) => {
    requestAnimationFrame(frame);
    if (!visible || document.hidden || t - last < 30) return;
    last = t;
    presence += (want - presence) * 0.08;
    draw(t);
  };
  requestAnimationFrame(frame);
}
