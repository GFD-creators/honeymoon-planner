import {
  weekStartSunday, weekDays, addWeeks,
  timeToMinutes, minutesToTop, blockHeight, splitTimedAllDay,
} from './week.js';
import { openEditor } from './editor.js';
import { update } from './store.js';
import { attachDrag } from './drag.js';

const GRID = { startHour: 0, endHour: 24, hourHeight: 48 }; // 0:00〜24:00（早朝便も表示）
const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];
const TYPE_CLS = { flight: 'flight', sightseeing: 'sightseeing', hotel: 'hotel', food: 'food', other: 'other' };

let currentWeekStart = null; // モジュール内で表示中の週を保持

export function renderWeekView(root, state) {
  root.innerHTML = '';
  const tripStartDate = state.meta?.startDate || '2026-09-12';
  if (!currentWeekStart) currentWeekStart = weekStartSunday(tripStartDate);

  const days = weekDays(currentWeekStart);
  const tripStart = state.meta?.startDate;
  const tripEnd = state.meta?.endDate;

  // ナビ
  const nav = document.createElement('div');
  nav.className = 'week-nav';
  const prev = navBtn('‹ 前の週', () => { currentWeekStart = addWeeks(currentWeekStart, -1); renderWeekView(root, state); });
  const label = document.createElement('span');
  label.className = 'week-label';
  label.textContent = `${days[0].slice(5).replace('-', '/')} 〜 ${days[6].slice(5).replace('-', '/')}`;
  const next = navBtn('次の週 ›', () => { currentWeekStart = addWeeks(currentWeekStart, 1); renderWeekView(root, state); });
  const jump = navBtn('旅程の週へ', () => { currentWeekStart = weekStartSunday(tripStartDate); renderWeekView(root, state); });
  nav.append(prev, label, next, jump);
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

  // 各曜日列
  days.forEach((d, i) => {
    const inTrip = tripStart && tripEnd && d >= tripStart && d <= tripEnd;
    const col = document.createElement('div');
    col.className = 'week-col' + (inTrip ? ' in-trip' : '');

    const head = document.createElement('div');
    head.className = 'col-head' + (inTrip ? ' in-trip' : '');
    head.innerHTML = `<span class="dow">${WEEKDAYS[i]}</span><span class="dom">${Number(d.slice(8))}</span>`;
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

function navBtn(text, onClick) {
  const b = document.createElement('button');
  b.className = 'link';
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
