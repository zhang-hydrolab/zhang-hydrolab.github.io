/** Publication search and filters. State lives in the URL so views can be shared. */
export default function init(root) {
  const input = root.querySelector('[data-filter-q]');
  const topicButtons = [...root.querySelectorAll('[data-filter-topic]')];
  const yearButtons = [...root.querySelectorAll('[data-filter-year]')];
  const flagButtons = [...root.querySelectorAll('[data-filter-flag]')];
  const items = [...root.querySelectorAll('.pub')];
  const groups = [...root.querySelectorAll('.year')];
  const count = root.querySelector('[data-filter-count]');
  const empty = root.querySelector('[data-filter-empty]');

  const params = new URLSearchParams(location.search);
  // Older shared links may name a filter the page no longer has; those are ignored.
  const known = new Set(flagButtons.map((button) => button.dataset.filterFlag));
  // The box may already hold text typed while this module was loading.
  const state = {
    q: params.get('q') ?? input.value,
    topic: params.get('topic') ?? '',
    year: params.get('year') ?? '',
    only: new Set((params.get('only') ?? '').split(',').filter((flag) => known.has(flag))),
  };
  input.value = state.q;

  const render = ({ pushUrl = true } = {}) => {
    const words = state.q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    let shown = 0;
    for (const item of items) {
      const match =
        (!state.year || item.dataset.year === state.year) &&
        (!state.topic || item.dataset.topics.split('|').includes(state.topic)) &&
        [...state.only].every((flag) => item.dataset[flag] === '1') &&
        words.every((w) => item.dataset.search.includes(w));
      item.hidden = !match;
      if (match) shown += 1;
    }
    for (const group of groups) group.hidden = !group.querySelector('.pub:not([hidden])');
    empty.hidden = shown > 0;

    const zh = document.documentElement.dataset.lang === 'zh';
    count.textContent = zh ? `显示 ${shown} / ${items.length} 篇` : `${shown} of ${items.length} papers`;

    for (const button of topicButtons) {
      const on = button.dataset.filterTopic === state.topic;
      button.classList.toggle('is-on', on);
      button.setAttribute('aria-pressed', String(on));
    }
    for (const button of yearButtons) button.setAttribute('aria-pressed', String(button.dataset.filterYear === state.year));
    for (const button of flagButtons) button.setAttribute('aria-pressed', String(state.only.has(button.dataset.filterFlag)));

    if (pushUrl) {
      const next = new URLSearchParams();
      if (state.q.trim()) next.set('q', state.q.trim());
      if (state.topic) next.set('topic', state.topic);
      if (state.year) next.set('year', state.year);
      if (state.only.size) next.set('only', [...state.only].join(','));
      const query = next.toString();
      history.replaceState(null, '', query ? `?${query}` : location.pathname);
    }
  };

  input.addEventListener('input', () => {
    state.q = input.value;
    render();
  });
  for (const button of topicButtons) {
    button.addEventListener('click', () => {
      state.topic = button.dataset.filterTopic;
      render();
    });
  }
  for (const button of yearButtons) {
    button.addEventListener('click', () => {
      state.year = state.year === button.dataset.filterYear ? '' : button.dataset.filterYear;
      render();
    });
  }
  for (const button of flagButtons) {
    button.addEventListener('click', () => {
      const flag = button.dataset.filterFlag;
      if (state.only.has(flag)) state.only.delete(flag);
      else state.only.add(flag);
      render();
    });
  }
  addEventListener('keydown', (event) => {
    if (event.key === '/' && !event.target.closest('input, textarea, dialog')) {
      event.preventDefault();
      input.focus();
    }
  });
  addEventListener('lab:lang', () => render({ pushUrl: false }));

  render({ pushUrl: false });
}
