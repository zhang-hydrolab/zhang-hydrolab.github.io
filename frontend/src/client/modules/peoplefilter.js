/** Role filter, name search and the detail sheet for each person. */
export default function init(root) {
  const input = root.querySelector('[data-people-q]');
  const buttons = [...root.querySelectorAll('[data-people-role]')];
  const groups = [...root.querySelectorAll('[data-group]')];
  const dialog = document.querySelector('[data-person-dialog]');
  const slot = dialog.querySelector('[data-person-slot]');
  let role = '';

  const render = () => {
    const words = input.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    for (const group of groups) {
      const inRole = !role || group.dataset.group === role;
      let shown = 0;
      for (const person of group.querySelectorAll('.person')) {
        const match = inRole && words.every((w) => person.dataset.search.includes(w));
        person.hidden = !match;
        if (match) shown += 1;
      }
      group.hidden = shown === 0;
    }
    for (const button of buttons) {
      const on = button.dataset.peopleRole === role;
      button.classList.toggle('is-on', on);
      button.setAttribute('aria-pressed', String(on));
    }
  };

  const openPerson = (person, trigger) => {
    slot.replaceChildren(person.querySelector('.person__detail').cloneNode(true));
    slot.querySelector('h3').id = 'person-dialog-title';
    dialog.dataset.returnId = person.id;
    dialog.showModal();
    trigger?.blur();
  };

  input.addEventListener('input', render);
  for (const button of buttons) {
    button.addEventListener('click', () => {
      role = button.dataset.peopleRole;
      render();
    });
  }
  root.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-person]');
    if (trigger) openPerson(trigger.closest('.person'), trigger);
  });

  dialog.querySelector('[data-dialog-close]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener('close', () => {
    document.getElementById(dialog.dataset.returnId)?.querySelector('[data-person]')?.focus();
  });

  // The box may already hold text typed while this module was loading.
  if (input.value) render();

  // Search results link straight to a person.
  if (location.hash.startsWith('#p-')) {
    const person = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (person) openPerson(person);
  }
}
