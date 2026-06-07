import { totalPlanned, totalActual, perPerson, toEUR, remaining } from './budget.js';
import { update } from './store.js';

const COLORS = ['#ff7eb6', '#ffd166', '#5ed6c0', '#6ec6ff', '#c08cff', '#ff9f7e'];

export function renderBudget(root, state) {
  const items = state.budget;
  const rate = state.meta?.rates?.EUR || 180;
  const people = state.meta?.people || 2;
  const planned = totalPlanned(items);

  // 合計カード
  const total = document.createElement('div');
  total.className = 'card total-card';
  total.innerHTML =
    `<div class="sub">総予算</div>` +
    `<div class="yen">¥${planned.toLocaleString()}</div>` +
    `<div class="sub">1人あたり ¥${perPerson(planned, people).toLocaleString()}` +
    ` ／ €${toEUR(planned, rate).toLocaleString()}</div>` +
    `<div class="sub">実績 ¥${totalActual(items).toLocaleString()}` +
    `（残 ¥${remaining(items).toLocaleString()}）</div>`;
  root.appendChild(total);

  // 内訳バー
  const breakdown = document.createElement('div');
  breakdown.className = 'card';
  items.forEach((it, i) => {
    const pct = planned ? Math.round((it.planned / planned) * 100) : 0;
    const row = document.createElement('div');
    row.className = 'bar-row';
    row.innerHTML =
      `<div class="label"><span>${it.category}</span>` +
      `<span>¥${it.planned.toLocaleString()}（${pct}%）</span></div>` +
      `<div class="bar-track"><div class="bar-fill" style="width:${pct}%;` +
      `background:${COLORS[i % COLORS.length]}"></div></div>`;
    row.addEventListener('click', () => editBudget(it));
    breakdown.appendChild(row);
  });
  root.appendChild(breakdown);

  const hint = document.createElement('p');
  hint.className = 'sub';
  hint.style.textAlign = 'center';
  hint.textContent = '項目をタップで予算/実績を編集';
  root.appendChild(hint);
}

function editBudget(item) {
  const planned = prompt(`${item.category} の予算（円）`, item.planned);
  if (planned === null) return;
  const actual = prompt(`${item.category} の実績（円）`, item.actual);
  if (actual === null) return;
  update((s) => {
    const t = s.budget.find((b) => b.category === item.category);
    if (t) { t.planned = Number(planned) || 0; t.actual = Number(actual) || 0; }
  });
}
