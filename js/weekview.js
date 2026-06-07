import {
  addDays, weekdayIndex, daysBetween,
  timeToMinutes, minutesToTop, blockHeight, splitTimedAllDay,
  snapMinutes, topToMinutes, minutesToTime,
} from './week.js';
import { openEditor } from './editor.js';
import { update } from './store.js';
import { attachDrag } from './drag.js';

const GRID = { startHour: 0, endHour: 24, hourHeight: 48 }; // 0:00〜24:00
const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];
const TYPE_CLS = { flight: 'flight', sightseeing: 'sightseeing', hotel: 'hotel', food: 'food', other: 'other' };

let currentPage = 0; // 0始まりの旅行ページ

export function renderWeekView(root, state) {
  root.innerHTML = '';
  const start = state.meta?.startDate || '2026-09-12';
  const end = state.meta?.endDate || '2026-09-23';
  const lastPage = Math.max(0, Math.floor(daysBetween(start, end) / 7));
  if (currentPage < 0) currentPage = 0;
  if (currentPage > lastPage) currentPage = lastPage;

  const pageStart = addDays(start, currentPage * 7);
  const pageEndCandidate = addDays(pageStart, 6);
  const pageEnd = daysBetween(pageEndCandidate, end) >= 0 ? pageEndCandidate : end;
  const span = daysBetween(pageStart, pageEnd);
  const days = [];
  for (let i = 0; i <= span; i++) days.push(addDays(pageStart, i));

  // ナビ
  const nav = document.createElement('div');
  nav.className = 'week-nav';
  const prev = navBtn('‹ 前', currentPage === 0, () => {
    if (currentPage > 0) { currentPage--; renderWeekView(root, state); }
  });
  const label = document.createElement('span');
  label.className = 'week-label';
  label.textContent = `${pageStart.slice(5).replace('-', '/')} 〜 ${pageEnd.slice(5).replace('-', '/')}`;
  const next = navBtn('次 ›', currentPage === lastPage, () => {
    if (currentPage < lastPage) { currentPage++; renderWeekView(root, state); }
  });
  nav.append(prev, label, next);
  root.appendChild(nav);

  const dragCtx = {
    opts: GRID,
    snapStep: 30,
    getColumns() {
      return [...root.querySelectorAll('.col-body')].map((el) => ({
        date: el.dataset.date,
        rect: el.getBoundingClientRect(),
      }));
    },
    onCommit(id, patch) {
      update((s) => {
        const t = s.events.find((e) => e.id === id);
        if (t) Object.assign(t, patch);
      });
    },
    onTap(ev) { openEditor(ev); },
  };

  // 日別グルーピング
  const byDay = {};
  for (const d of days) byDay[d] = [];
  for (const ev of state.events) {
    if (byDay[ev.date]) byDay[ev.date].push(ev);
  }

  // 横スクロールラッパ＋グリッド
  const scroller = document.createElement('div');
  scroller.className = 'week-scroller';
  const grid = document.createElement('div');
  grid.className = 'week-grid';

  // 時刻軸列
  const axis = document.createElement('div');
  axis.className = 'week-axis';
  axis.appendChild(cell('axis-corner'));
  axis.appendChild(cell('axis-allday'));
  for (let h = GRID.startHour; h < GRID.endHour; h++) {
    const c = document.createElement('div');
    c.className = 'axis-hour';
    c.style.height = GRID.hourHeight + 'px';
    c.textContent = `${h % 24}:00`;
    axis.appendChild(c);
  }
  grid.appendChild(axis);

  // 各日列（旅行期間内のみ）
  days.forEach((d) => {
    const col = document.createElement('div');
    col.className = 'week-col in-trip';

    const head = document.createElement('div');
    head.className = 'col-head in-trip';
    head.innerHTML = `<span class="dow">${WEEKDAYS[weekdayIndex(d)]}</span><span class="dom">${Number(d.slice(8))}</span>`;
    col.appendChild(head);

    const { timed, allDay } = splitTimedAllDay(byDay[d]);

    const allDayCell = document.createElement('div');
    allDayCell.className = 'col-allday';
    allDay.forEach((ev) => {
      const chip = document.createElement('button');
      chip.className = `allday-chip ${TYPE_CLS[ev.type] || 'sightseeing'}`;
      chip.textContent = ev.title;
      chip.addEventListener('click', () => openEditor(ev));
      allDayCell.appendChild(chip);
    });
    col.appendChild(allDayCell);

    const body = document.createElement('div');
    body.className = 'col-body';
    body.dataset.date = d;
    body.style.height = (GRID.endHour - GRID.startHour) * GRID.hourHeight + 'px';
    body.addEventListener('click', (e) => {
      if (e.target.closest('.event-block')) return; // ブロック上は従来の編集
      const top = body.getBoundingClientRect().top;
      const min = snapMinutes(topToMinutes(e.clientY - top, GRID), 30);
      openEditor(null, { defaultDate: d, defaultTime: minutesToTime(min) });
    });
    for (let h = GRID.startHour; h < GRID.endHour; h++) {
      const line = document.createElement('div');
      line.className = 'hour-line';
      line.style.top = (h - GRID.startHour) * GRID.hourHeight + 'px';
      body.appendChild(line);
    }
    layoutTimed(timed).forEach(({ ev, lane, lanes }) => {
      const block = document.createElement('button');
      block.className = `event-block ${TYPE_CLS[ev.type] || 'sightseeing'}`;
      block.style.top = minutesToTop(timeToMinutes(ev.time), GRID) + 'px';
      block.style.height = blockHeight(ev.time, ev.endTime, GRID) + 'px';
      block.style.left = (lane / lanes) * 100 + '%';
      block.style.width = (1 / lanes) * 100 + '%';
      block.innerHTML = `<span class="bk-time">${ev.time}</span><span class="bk-title">${ev.title}</span>`;
      const handle = document.createElement('div');
      handle.className = 'resize-handle';
      block.appendChild(handle);
      attachDrag(block, ev, dragCtx);
      body.appendChild(block);
    });
    col.appendChild(body);
    grid.appendChild(col);
  });

  scroller.appendChild(grid);
  root.appendChild(scroller);
}

function navBtn(text, disabled, onClick) {
  const b = document.createElement('button');
  b.className = 'link' + (disabled ? ' is-disabled' : '');
  b.textContent = text;
  b.addEventListener('click', onClick);
  return b;
}

function cell(cls) {
  const el = document.createElement('div');
  el.className = cls;
  return el;
}

// 簡易レーン割当：時間が重なる予定を横に並べる
function layoutTimed(timed) {
  const sorted = [...timed].sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));
  const laneEnds = [];
  const placed = [];
  for (const ev of sorted) {
    const start = timeToMinutes(ev.time);
    const end = ev.endTime ? timeToMinutes(ev.endTime) : start + 60;
    let lane = laneEnds.findIndex((e) => e <= start);
    if (lane === -1) { lane = laneEnds.length; laneEnds.push(end); }
    else laneEnds[lane] = end;
    placed.push({ ev, lane });
  }
  const lanes = Math.max(1, laneEnds.length);
  return placed.map((p) => ({ ...p, lanes }));
}
