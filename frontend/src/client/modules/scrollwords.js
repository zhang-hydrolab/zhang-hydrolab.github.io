/** Words surface one by one as the statement scrolls through the viewport. */
export default function init(block, { reduceMotion }) {
  if (reduceMotion) return;

  const groups = [...block.querySelectorAll('.t-en, .t-zh')];
  if (!groups.length) groups.push(block);

  const split = (group) => {
    const isZh = group.classList.contains('t-zh');
    const tokens = isZh ? [...group.textContent] : group.textContent.split(/(\s+)/);
    group.textContent = '';
    const words = [];
    for (const token of tokens) {
      if (!token.trim()) {
        group.append(token);
        continue;
      }
      const span = document.createElement('span');
      span.className = 'w';
      span.textContent = token;
      group.append(span);
      words.push(span);
    }
    return words;
  };

  const sets = groups.map(split);

  const update = () => {
    const box = block.getBoundingClientRect();
    const span = box.height + innerHeight * 0.32;
    const progress = Math.min(1, Math.max(0, (innerHeight * 0.86 - box.top) / span));
    for (const words of sets) {
      const reached = Math.floor(progress * words.length * 1.08);
      words.forEach((word, i) => word.classList.toggle('is-on', i < reached));
    }
  };

  let ticking = false;
  addEventListener(
    'scroll',
    () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        update();
      });
    },
    { passive: true },
  );
  update();
}
