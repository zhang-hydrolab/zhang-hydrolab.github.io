/** Lights a city, its line to Beijing and its collaborators together, from either side. */
export default function init(root) {
  const map = root.querySelector('.worldmap');
  const marks = [...map.querySelectorAll('[data-place]')].map((mark) => ({ mark, ids: mark.dataset.place.split(' ') }));

  const light = (ids, on) => {
    map.classList.toggle('has-on', on);
    for (const { mark, ids: own } of marks) {
      if (own.some((id) => ids.includes(id))) mark.classList.toggle('is-on', on);
    }
    for (const id of ids) document.getElementById(id)?.classList.toggle('is-on', on);
  };

  for (const { mark, ids } of marks) {
    if (mark.tagName.toLowerCase() !== 'a') continue;
    mark.addEventListener('pointerenter', () => light(ids, true));
    mark.addEventListener('pointerleave', () => light(ids, false));
    mark.addEventListener('focus', () => light(ids, true));
    mark.addEventListener('blur', () => light(ids, false));
  }
  for (const card of root.querySelectorAll('.collab')) {
    if (!marks.some(({ ids }) => ids.includes(card.id))) continue;
    card.addEventListener('pointerenter', () => light([card.id], true));
    card.addEventListener('pointerleave', () => light([card.id], false));
  }
}
