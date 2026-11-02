/** Year filter, plus an image that trails the pointer along each headline. */
export default function init(root, { finePointer, reduceMotion }) {
  const buttons = [...root.querySelectorAll('[data-news-year]')];
  const rows = [...root.querySelectorAll('.newsrows li')];

  for (const button of buttons) {
    button.addEventListener('click', () => {
      const year = button.dataset.newsYear;
      for (const b of buttons) {
        const on = b === button;
        b.classList.toggle('is-on', on);
        b.setAttribute('aria-pressed', String(on));
      }
      for (const row of rows) row.hidden = Boolean(year) && row.dataset.year !== year;
    });
  }

  const preview = root.querySelector('[data-news-preview]');
  if (!finePointer || reduceMotion || !preview) return;

  let x = 0;
  let y = 0;
  let cx = 0;
  let cy = 0;
  let running = false;

  const frame = () => {
    cx += (x - cx) * 0.16;
    cy += (y - cy) * 0.16;
    preview.style.transform = `translate(${cx + 28}px, ${cy - 110}px)`;
    if (running) requestAnimationFrame(frame);
  };

  for (const link of root.querySelectorAll('[data-preview]')) {
    link.addEventListener('pointerenter', (event) => {
      if (!link.dataset.preview) return;
      preview.src = link.dataset.preview;
      preview.hidden = false;
      cx = event.clientX;
      cy = event.clientY;
      x = cx;
      y = cy;
      if (!running) {
        running = true;
        requestAnimationFrame(frame);
      }
    });
    link.addEventListener('pointermove', (event) => {
      x = event.clientX;
      y = event.clientY;
    });
    link.addEventListener('pointerleave', () => {
      preview.hidden = true;
      running = false;
    });
  }
}
