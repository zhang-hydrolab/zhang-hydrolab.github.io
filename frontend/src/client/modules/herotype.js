/**
 * The title behaves like a water surface: the variable font swells around the
 * pointer, and a slow swell passes through it when nothing is touching it.
 */
export default function init(title, { reduceMotion, finePointer }) {
  const line = title.querySelectorAll('.t-en .hl');
  if (reduceMotion || !line.length) return;

  const letters = [];
  line.forEach((hl) => {
    const text = hl.textContent;
    hl.setAttribute('aria-label', text);
    hl.textContent = '';
    for (const char of text) {
      const span = document.createElement('span');
      span.className = 'ch';
      span.setAttribute('aria-hidden', 'true');
      span.textContent = char;
      hl.append(span);
      letters.push({ span, x: 0, y: 0, w: 75, g: 800 });
    }
  });

  const measure = () => {
    for (const letter of letters) {
      const box = letter.span.getBoundingClientRect();
      letter.x = box.left + box.width / 2;
      letter.y = box.top + box.height / 2;
    }
  };

  let px = -9999;
  let py = -9999;
  let active = false;
  if (finePointer) {
    const host = title.closest('.hero');
    host.addEventListener('pointermove', (event) => {
      px = event.clientX;
      py = event.clientY;
      active = true;
    }, { passive: true });
    host.addEventListener('pointerleave', () => {
      active = false;
    });
  }

  let visible = true;
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
  }).observe(title);

  // The rise-in animation shifts the letters, so measure after it settles.
  setTimeout(measure, 1500);
  addEventListener('resize', measure, { passive: true });

  const radius = () => Math.max(240, innerWidth * 0.2);
  const frame = (now) => {
    requestAnimationFrame(frame);
    if (!visible) return;
    const t = now / 1000;
    const r = radius();
    letters.forEach((letter, i) => {
      let lift;
      if (active) {
        const dist = Math.hypot(px - letter.x, py - letter.y);
        lift = Math.max(0, 1 - dist / r) ** 2;
      } else {
        lift = Math.max(0, Math.sin(t * 0.8 - i * 0.42)) ** 6 * 0.32;
      }
      const w = 75 + lift * 34;
      const g = 800 - lift * 420;
      letter.w += (w - letter.w) * 0.14;
      letter.g += (g - letter.g) * 0.14;
      letter.span.style.setProperty('--w', letter.w.toFixed(1));
      letter.span.style.setProperty('--g', letter.g.toFixed(0));
    });
  };
  requestAnimationFrame(frame);
}
