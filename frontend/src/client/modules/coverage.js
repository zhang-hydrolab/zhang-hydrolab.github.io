/** Picks a dataset from the coverage chart and shows its spec beside it. */
export default function init(root) {
  const rows = [...root.querySelectorAll('[data-cov]')];
  const panels = [...root.querySelectorAll('[data-cov-panel]')];
  const select = (id) => {
    for (const row of rows) {
      const on = row.dataset.cov === id;
      row.classList.toggle('is-active', on);
      row.setAttribute('aria-pressed', String(on));
    }
    for (const panel of panels) panel.classList.toggle('is-active', panel.dataset.covPanel === id);
  };
  for (const row of rows) {
    row.addEventListener('click', () => select(row.dataset.cov));
    row.addEventListener('pointerenter', (event) => {
      if (event.pointerType === 'mouse') select(row.dataset.cov);
    });
  }
}
