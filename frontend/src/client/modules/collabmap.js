/**
 * Lights a city, its line to Beijing and its collaborators together, from either side, and opens
 * a collaborator's profile in a sheet.
 */
export default function init(root) {
  const map = root.querySelector('.worldmap');
  // Where the map scrolls (on a phone), start with Beijing in the middle.
  const frame = map.parentElement;
  if (frame.scrollWidth > frame.clientWidth) frame.scrollLeft = (frame.scrollWidth - frame.clientWidth) / 2;
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

  // The profile. The sheet follows the page language, since it is part of the page.
  const dialog = document.querySelector('[data-collab-dialog]');
  const slot = dialog.querySelector('[data-collab-slot]');

  const open = (card) => {
    slot.replaceChildren(card.querySelector('.collab__detail').cloneNode(true));
    slot.querySelector('h3').id = 'collab-dialog-title';
    dialog.dataset.returnId = card.id;
    dialog.showModal();
    dialog.scrollTop = 0;
    history.replaceState(null, '', `#${card.id}`);
  };

  root.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-collab]');
    if (trigger) open(trigger.closest('.collab'));
  });
  // A city with one collaborator opens the profile; one with several scrolls to their cards.
  map.addEventListener('click', (event) => {
    const ids = event.target.closest('a[data-place]')?.dataset.place.split(' ');
    if (ids?.length !== 1) return;
    event.preventDefault();
    open(document.getElementById(ids[0]));
  });
  dialog.querySelector('[data-dialog-close]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener('close', () => {
    history.replaceState(null, '', location.pathname + location.search);
    document.getElementById(dialog.dataset.returnId)?.querySelector('[data-collab]')?.focus();
  });

  // A link to a collaborator, from search or elsewhere, opens the profile.
  const linked = location.hash ? document.getElementById(decodeURIComponent(location.hash.slice(1))) : null;
  if (linked?.classList.contains('collab')) open(linked);
}
