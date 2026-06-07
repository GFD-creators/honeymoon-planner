import { formatLocalAndJapan } from './timezone.js';
import { update } from './store.js';

const TYPE_META = {
  flight: { cls: 'flight', icon: '🛫' },
  sightseeing: { cls: 'sightseeing', icon: '📸' },
  hotel: { cls: 'hotel', icon: '🏨' },
  food: { cls: 'food', icon: '🍽' },
};

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

function weekdayOf(dateStr) {
  // タイムゾーン非依存で曜日を計算（UTC固定）
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
  const byDate = {};
  for (const ev of state.events) {
    (byDate[ev.date] ||= []).push(ev);
  }
  const dates = Object.keys(byDate).sort();

  for (const date of dates) {
    const head = document.createElement('div');
    head.className = 'day-head';
    head.innerHTML =
      `<span class="date">${date.slice(5).replace('-', '/')}</span>` +
      `<span class="weekday">(${weekdayOf(date)})</span>`;
    root.appendChild(head);

    const events = byDate[date].sort((a, b) => (a.time || '').localeCompare(b.time || ''));
    for (const ev of events) {
      root.appendChild(eventCard(ev));
    }
  }

  const fab = document.createElement('button');
  fab.className = 'fab';
  fab.textContent = '＋';
  fab.title = '予定を追加';
  fab.addEventListener('click', () => addEvent(dates[0]));
  root.appendChild(fab);
}

function eventCard(ev) {
  const meta = TYPE_META[ev.type] || TYPE_META.sightseeing;
  const el = document.createElement('div');
  el.className = `card event ${meta.cls}`;

  let timeHtml = '';
  if (ev.time) {
    const t = formatLocalAndJapan(ev.city, ev.date, ev.time);
    const [local, jp] = t.split(' / ');
    timeHtml = `<div class="time">${meta.icon} ${local}` +
      (jp ? ` <span class="jp">/ ${jp}</span>` : '') + `</div>`;
  } else {
    timeHtml = `<div class="time">${meta.icon} 終日</div>`;
  }

  const layover = /待ち/.test(ev.title)
    ? `<span class="badge layover">乗継待ち</span>` : '';
  const flightBadge = ev.type === 'flight'
    ? `<span class="badge flight">${ev.city}</span>` : '';

  el.innerHTML =
    timeHtml +
    `<div class="ttl">${flightBadge}${layover}${ev.title}</div>` +
    (ev.hotel ? `<div class="meta">🏨 宿: ${ev.hotel}</div>` : '') +
    (mealLabel(ev.meals) ? `<div class="meta">${mealLabel(ev.meals)}</div>` : '');

  el.addEventListener('click', () => editEvent(ev));
  return el;
}

function editEvent(ev) {
  const title = prompt('内容を編集', ev.title);
  if (title === null) return;
  const time = prompt('時刻（HH:MM、終日は空欄）', ev.time || '');
  if (time === null) return;
  update((s) => {
    const target = s.events.find((e) => e.id === ev.id);
    if (target) { target.title = title; target.time = time; }
  });
}

function addEvent(defaultDate) {
  const date = prompt('日付（YYYY-MM-DD）', defaultDate);
  if (!date) return;
  const title = prompt('内容', '');
  if (!title) return;
  const time = prompt('時刻（HH:MM、終日は空欄）', '') || '';
  const city = prompt('都市（東京/韓国/ロンドン/パリ/ヴェネチア/ローマ）', 'パリ') || '';
  update((s) => {
    s.events.push({ id: 'e' + Date.now(), date, time, city, type: 'sightseeing', title, meals: {} });
  });
}
