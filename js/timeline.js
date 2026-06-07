import { formatLocalAndJapan } from './timezone.js';
import { openEditor } from './editor.js';
import { renderWeekView } from './weekview.js';

const TYPE_META = {
  flight: { cls: 'flight', icon: '🛫' },
  sightseeing: { cls: 'sightseeing', icon: '📸' },
  hotel: { cls: 'hotel', icon: '🏨' },
  food: { cls: 'food', icon: '🍽' },
  other: { cls: 'sightseeing', icon: '📍' },
};

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];
const VIEW_KEY = 'hp-timeline-view';

function loadView() {
  try { return localStorage.getItem(VIEW_KEY) || 'list'; } catch (e) { return 'list'; }
}
function saveView(v) {
  try { localStorage.setItem(VIEW_KEY, v); } catch (e) { /* ignore */ }
}

function weekdayOf(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const idx = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return WEEKDAYS[idx];
}

function mealLabel(meals = {}) {
  const parts = [];
  if (meals.breakfast) parts.push('朝');
  if (meals.lunch) parts.push('昼');
  if (meals.dinner) parts.push('夕');
  return parts.length ? `🍽 ${parts.join('・')}` : '';
}

export function renderTimeline(root, state) {
  const view = loadView();

  const toggle = document.createElement('div');
  toggle.className = 'view-toggle';
  const listBtn = toggleBtn('リスト', 'list');
  const weekBtn = toggleBtn('週', 'week');
  toggle.append(listBtn, weekBtn);
  root.appendChild(toggle);

  const container = document.createElement('div');
  container.className = 'timeline-container';
  root.appendChild(container);

  // ＋ボタン（両ビュー共通）
  const firstDate = state.meta?.startDate || '2026-09-12';
  const fab = document.createElement('button');
  fab.className = 'fab';
  fab.textContent = '＋';
  fab.title = '予定を追加';
  fab.addEventListener('click', () => openEditor(null, { defaultDate: firstDate }));
  root.appendChild(fab);

  function setView(v) {
    saveView(v);
    toggle.querySelectorAll('.toggle-btn').forEach((b) =>
      b.classList.toggle('is-active', b.dataset.view === v));
    root.classList.toggle('wide', v === 'week'); // 週表示のみ #view を広げる
    container.innerHTML = '';
    if (v === 'week') renderWeekView(container, state);
    else renderList(container, state);
  }

  function toggleBtn(label, value) {
    const b = document.createElement('button');
    b.className = 'toggle-btn';
    b.dataset.view = value;
    b.textContent = label;
    b.addEventListener('click', () => setView(value));
    return b;
  }

  setView(view);
}

function renderList(root, state) {
  const byDate = {};
  for (const ev of state.events) (byDate[ev.date] ||= []).push(ev);
  const dates = Object.keys(byDate).sort();

  for (const date of dates) {
    const head = document.createElement('div');
    head.className = 'day-head';
    head.innerHTML =
      `<span class="date">${date.slice(5).replace('-', '/')}</span>` +
      `<span class="weekday">(${weekdayOf(date)})</span>`;
    const addBtn = document.createElement('button');
    addBtn.className = 'add-day';
    addBtn.textContent = '＋';
    addBtn.title = 'この日に予定を追加';
    addBtn.addEventListener('click', () => openEditor(null, { defaultDate: date }));
    head.appendChild(addBtn);
    root.appendChild(head);

    const events = byDate[date].sort((a, b) => (a.time || '').localeCompare(b.time || ''));
    for (const ev of events) root.appendChild(eventCard(ev));
  }
}

function eventCard(ev) {
  const meta = TYPE_META[ev.type] || TYPE_META.sightseeing;
  const el = document.createElement('div');
  el.className = `card event ${meta.cls}`;

  let timeHtml;
  if (ev.time) {
    const t = formatLocalAndJapan(ev.city, ev.date, ev.time);
    const [local, jp] = t.split(' / ');
    timeHtml = `<div class="time">${meta.icon} ${local}` +
      (jp ? ` <span class="jp">/ ${jp}</span>` : '') + `</div>`;
  } else {
    timeHtml = `<div class="time">${meta.icon} 終日</div>`;
  }

  const layover = /待ち/.test(ev.title) ? `<span class="badge layover">乗継待ち</span>` : '';
  const flightBadge = ev.type === 'flight' && ev.city ? `<span class="badge flight">${ev.city}</span>` : '';

  el.innerHTML =
    timeHtml +
    `<div class="ttl">${flightBadge}${layover}${ev.title}</div>` +
    (ev.hotel ? `<div class="meta">🏨 宿: ${ev.hotel}</div>` : '') +
    (mealLabel(ev.meals) ? `<div class="meta">${mealLabel(ev.meals)}</div>` : '') +
    (ev.cost > 0 ? `<div class="meta">💴 ¥${Number(ev.cost).toLocaleString()}` +
      `${ev.costCategory ? `（${ev.costCategory}）` : ''}</div>` : '');

  el.addEventListener('click', () => openEditor(ev));
  return el;
}
