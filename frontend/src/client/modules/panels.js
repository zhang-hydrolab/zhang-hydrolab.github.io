/** Horizontal accordion: the panel you point at, focus or tap takes the room. */
export default function init(root) {
  const panels = [...root.querySelectorAll('.panel')];
  const open = (panel) => {
    for (const p of panels) p.classList.toggle('is-open', p === panel);
  };
  for (const panel of panels) {
    panel.addEventListener('pointerenter', (event) => {
      if (event.pointerType === 'mouse') open(panel);
    });
    panel.addEventListener('focusin', () => open(panel));
    panel.addEventListener('click', () => open(panel));
    panel.addEventListener('keydown', (event) => {
      if (event.target === panel && (event.key === 'Enter' || event.key === ' ')) {
        event.preventDefault();
        open(panel);
      }
    });
  }
}
