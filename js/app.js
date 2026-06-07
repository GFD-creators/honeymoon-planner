import { getState, subscribe } from './store.js';
import { renderTimeline } from './timeline.js';
import { renderPlaces } from './places.js';
import { renderBudget } from './budgetView.js';

const viewEl = document.getElementById('view');
let current = 'timeline';

const renderers = {
  timeline: renderTimeline,
  places: renderPlaces,
  budget: renderBudget,
};

function render() {
  const state = getState();
  viewEl.innerHTML = '';
  renderers[current](viewEl, state);
}

document.querySelectorAll('.tab').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((b) => b.classList.remove('is-active'));
    btn.classList.add('is-active');
    current = btn.dataset.tab;
    render();
  });
});

// 旅行期間をヘッダに反映
const meta = getState().meta;
if (meta) {
  document.getElementById('trip-range').textContent =
    `${meta.startDate.replaceAll('-', '/')} → ${meta.endDate.slice(5).replaceAll('-', '/')} ヨーロッパ`;
}

subscribe(render); // state 変化（自分の編集 / 後でFirestore）で再描画
render();
