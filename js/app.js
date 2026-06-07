import { getState, subscribe, initSync, shareUrl } from './store.js';
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
  viewEl.classList.remove('wide'); // 既定は narrow（週表示時に timeline が再付与）
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

// 共有ボタン（ヘッダに追加）
const shareBtn = document.createElement('button');
shareBtn.className = 'link';
shareBtn.textContent = '🔗 共有リンクをコピー';
shareBtn.style.cssText = 'display:block;margin:8px auto 0;color:#fff;';
shareBtn.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(shareUrl());
    shareBtn.textContent = '✅ コピーしました！LINEで送ろう';
    setTimeout(() => (shareBtn.textContent = '🔗 共有リンクをコピー'), 2000);
  } catch (e) {
    prompt('このURLをコピーして共有してください', shareUrl());
  }
});
document.querySelector('.app-header').appendChild(shareBtn);

initSync().catch((e) => console.warn('sync init failed, offline mode', e));
render();
