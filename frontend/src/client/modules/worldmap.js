/** Links map locations to the collaborator cards below, in both directions. */
export default function init(root) {
  const map = root.querySelector('.worldmap');
  const places = [...map.querySelectorAll('[data-place]')];
  const cards = [...document.querySelectorAll('[data-collab]')];

  const setPlace = (place, on) => {
    place.classList.toggle('is-on', on);
    for (const id of place.dataset.place.split(' ')) document.getElementById(id)?.classList.toggle('is-on', on);
  };

  for (const place of places) {
    place.addEventListener('pointerenter', () => setPlace(place, true));
    place.addEventListener('pointerleave', () => setPlace(place, false));
    place.addEventListener('click', () => {
      document.getElementById(place.dataset.place.split(' ')[0])?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }
  for (const card of cards) {
    const place = places.find((p) => p.dataset.place.split(' ').includes(card.dataset.collab));
    if (!place) continue;
    card.addEventListener('pointerenter', () => place.classList.add('is-on'));
    card.addEventListener('pointerleave', () => place.classList.remove('is-on'));
  }
}
