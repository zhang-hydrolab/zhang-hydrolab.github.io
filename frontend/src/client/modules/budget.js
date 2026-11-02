import { budgetLayout, budgetSvg, flowValues } from '../../lib/budget.mjs';

const fmt = (n) => n.toFixed(1);

export default function init(section, { reduceMotion }) {
  const budget = JSON.parse(section.querySelector('#budget-data').textContent);
  const svg = section.querySelector('[data-budget-svg]');
  const stage = section.querySelector('.budget__stage');
  const tip = section.querySelector('[data-budget-tip]');
  const note = section.querySelector('[data-budget-note]');
  const buttons = [...section.querySelectorAll('[data-period]')];
  const scaleRows = [...section.querySelectorAll('[data-scale]')];
  const scaleKeys = scaleRows.map((row) => row.dataset.scale);
  const scaleMax = Math.max(...scaleKeys.map((k) => (budget.flows[k].future ?? budget.flows[k].historical)[0]));

  let mix = 0;
  let target = 0;
  let width = 0;
  let height = 0;

  const size = () => {
    const available = Math.round(stage.clientWidth);
    const nextHeight = available < 640 ? 640 : Math.round(Math.min(680, Math.max(520, available * 0.46)));
    if (available === width && nextHeight === height) return false;
    width = available;
    height = nextHeight;
    return true;
  };

  const rebuild = () => {
    const layout = budgetLayout(budget, mix, { width, height });
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.classList.toggle('is-narrow', layout.narrow);
    svg.innerHTML = budgetSvg(budget, layout);
    apply(layout);
    if (reduceMotion) svg.querySelectorAll('.spine').forEach((el) => el.remove());
  };

  /** Moves existing elements, so hover state and focus survive the tween. */
  const apply = (layout) => {
    for (const link of layout.links) {
      svg.querySelector(`[data-link="${link.id}"]`)?.setAttribute('d', link.d);
      svg.querySelector(`[data-spine="${link.id}"]`)?.setAttribute('d', link.spine);
    }
    for (const node of layout.nodes) {
      const rect = svg.querySelector(`[data-node="${node.id}"]`);
      if (!rect) continue;
      rect.setAttribute('x', node.x);
      rect.setAttribute('y', node.y);
      rect.setAttribute('height', Math.max(1, node.h));
    }
    for (const key of ['land_precipitation', 'land_et', 'river_flow']) {
      const node = layout.nodes.find((n) => n.id === key);
      const x = key === 'land_precipitation' ? layout.labelA : layout.labelB;
      const value = svg.querySelector(`[data-value="${key}"]`);
      const cap = svg.querySelector(`[data-label="${key}"]`);
      if (value) {
        value.textContent = fmt(layout.flows[key].value);
        value.setAttribute('x', x);
        value.setAttribute('y', node.y + layout.valueY);
      }
      cap?.setAttribute('x', x);
      cap?.setAttribute('y', node.y + layout.capY);
    }
    for (const node of layout.nodes.filter((n) => n.detail)) {
      svg.querySelector(`[data-row="${node.id}"]`)?.setAttribute('y', node.y + node.h / 2 + 4);
    }
    svg.style.setProperty('--detail', layout.detail.toFixed(3));
    svg.classList.toggle('no-detail', layout.detail < 0.05);
    svg.querySelectorAll('.is-detail').forEach((el) => {
      el.style.pointerEvents = layout.detail < 0.05 ? 'none' : '';
    });

    const values = flowValues(budget, mix);
    scaleRows.forEach((row, i) => {
      const flow = values[scaleKeys[i]];
      row.querySelector('[data-scale-value]').textContent = fmt(flow.value);
      row.querySelector('[data-scale-error]').textContent = fmt(flow.error);
      row.querySelector('.scale__bar').style.setProperty('--v', (flow.value / scaleMax).toFixed(4));
    });
  };

  const draw = () => apply(budgetLayout(budget, mix, { width, height }));

  const animateTo = (next) => {
    target = next;
    note.hidden = next !== 1;
    if (reduceMotion) {
      mix = next;
      draw();
      return;
    }
    const from = mix;
    const started = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - started) / 900);
      const eased = t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
      mix = from + (target - from) * eased;
      draw();
      if (t < 1 && target === next) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  for (const button of buttons) {
    button.addEventListener('click', () => {
      for (const b of buttons) b.setAttribute('aria-checked', String(b === button));
      animateTo(button.dataset.period === 'future' ? 1 : 0);
    });
  }
  section.querySelector('.switch').addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    const next = buttons.find((b) => b.getAttribute('aria-checked') === 'false');
    next.focus();
    next.click();
  });

  const describe = (id) => {
    const zh = document.documentElement.dataset.lang === 'zh';
    const name = (item) => (zh ? item.zh : item.en);
    const values = flowValues(budget, mix);
    if (id.startsWith('share_')) {
      const share = budget.et_shares[Number(id.slice(6))];
      return { value: `${share.share}% ± ${share.error}%`, label: `${name(share)} · ${zh ? '陆地蒸散发占比' : 'share of land ET'}` };
    }
    const flow = values[id];
    const share = (flow.value / values.land_precipitation.value) * 100;
    return { value: `${fmt(flow.value)} ± ${fmt(flow.error)}`, label: `${name(budget.flows[id])} · ${Math.round(share)}% ${zh ? '的陆地降水' : 'of land precipitation'}` };
  };

  const show = (link, x, y) => {
    svg.classList.add('has-focus');
    svg.querySelectorAll('.is-focus').forEach((el) => el.classList.remove('is-focus'));
    link.classList.add('is-focus');
    const { value, label } = describe(link.dataset.link);
    const strong = document.createElement('b');
    strong.textContent = value;
    const caption = document.createElement('span');
    caption.textContent = label;
    tip.replaceChildren(strong, caption);
    tip.hidden = false;
    const box = stage.getBoundingClientRect();
    const px = Math.min(Math.max(0, x - box.left + 14), box.width - tip.offsetWidth);
    const py = Math.max(0, y - box.top - tip.offsetHeight - 14);
    tip.style.setProperty('--tx', `${px}px`);
    tip.style.setProperty('--ty', `${py}px`);
  };

  const hide = () => {
    svg.classList.remove('has-focus');
    svg.querySelectorAll('.is-focus').forEach((el) => el.classList.remove('is-focus'));
    tip.hidden = true;
  };

  svg.addEventListener('pointermove', (event) => {
    const link = event.target.closest('[data-link]');
    if (link) show(link, event.clientX, event.clientY);
    else hide();
  });
  svg.addEventListener('pointerleave', hide);
  svg.addEventListener('focusin', (event) => {
    const link = event.target.closest('[data-link]');
    if (!link) return;
    const box = link.getBoundingClientRect();
    show(link, box.left + box.width / 2, box.top + box.height / 2);
  });
  svg.addEventListener('focusout', hide);

  size();
  rebuild();
  new ResizeObserver(() => {
    if (size()) rebuild();
  }).observe(stage);
}
