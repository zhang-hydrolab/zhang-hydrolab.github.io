/** Mouse drag for horizontal strips; touch and trackpads scroll natively. */
export default function init(strip, { finePointer }) {
  strip.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    const step = strip.firstElementChild.getBoundingClientRect().width + 16;
    strip.scrollBy({ left: event.key === 'ArrowRight' ? step : -step, behavior: 'smooth' });
  });

  if (!finePointer) return;
  let down = false;
  let moved = false;
  let startX = 0;
  let startScroll = 0;

  strip.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    down = true;
    moved = false;
    startX = event.clientX;
    startScroll = strip.scrollLeft;
  });
  addEventListener('pointermove', (event) => {
    if (!down) return;
    const delta = event.clientX - startX;
    if (Math.abs(delta) > 5) {
      moved = true;
      strip.classList.add('is-drag');
    }
    if (moved) strip.scrollLeft = startScroll - delta;
  });
  addEventListener('pointerup', () => {
    down = false;
    strip.classList.remove('is-drag');
  });
  strip.addEventListener('click', (event) => {
    if (moved) {
      event.preventDefault();
      moved = false;
    }
  }, true);
  strip.addEventListener('dragstart', (event) => event.preventDefault());
}
