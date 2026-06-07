# 週カレンダー表示＋日時ピッカー編集 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 旅程タブに「リスト／週」表示切替を追加し、Googleカレンダー風の週グリッド表示と、予定タップで日付・時刻をピッカー編集できる編集シートを実装する。

**Architecture:** 既存のモジュール分離（純粋ロジック＋描画モジュール＋store）に従う。週・時刻計算は純粋関数 `week.js`（単体テスト付き）に切り出す。編集は `editor.js`（モーダル）に集約しリスト/週の両方から呼ぶ。`timeline.js` は旅程タブのコンテナとして切替トグルとリスト描画を担い、週描画は `weekview.js` に委譲する。

**Tech Stack:** Vanilla JS (ES Modules), Node 組み込みテスト (`node --test`), 既存の `store.js`（localStorage + Firestore 同期）, GitHub Pages。

---

## ファイル構成

```
js/
├ week.js        — 新規。週・時刻の純粋計算（テスト対象）
├ editor.js      — 新規。編集シート（モーダル）。リスト/週の両方から使う
├ weekview.js    — 新規。週グリッド表示の描画
├ timeline.js    — 全面改訂。旅程タブのコンテナ（トグル＋リスト描画＋FAB）。prompt廃止
css/styles.css   — 追加（編集シート / 週グリッド / トグル）
tests/
└ week.test.js   — 新規。week.js の単体テスト
```

`app.js` / `store.js` / `seed.js` は変更しない（`renderTimeline` のシグネチャ維持、`endTime` は任意フィールド）。

グリッド定数（共通）: `startHour=5`, `endHour=26`（翌2:00）, `hourHeight=48`。

---

## Task 1: 週・時刻の純粋計算（week.js）TDD

**Files:**
- Create: `js/week.js`
- Test: `tests/week.test.js`

- [ ] **Step 1: 失敗するテストを書く**

`tests/week.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  weekStartSunday, weekDays, addWeeks,
  timeToMinutes, minutesToTop, blockHeight, splitTimedAllDay,
} from '../js/week.js';

const OPTS = { startHour: 5, hourHeight: 48 };

test('weekStartSunday: 土曜(9/12)が属する週の日曜は9/6', () => {
  assert.equal(weekStartSunday('2026-09-12'), '2026-09-06');
});

test('weekStartSunday: 日曜(9/13)はその日自身', () => {
  assert.equal(weekStartSunday('2026-09-13'), '2026-09-13');
});

test('weekDays: 日曜起点で7日分', () => {
  assert.deepEqual(weekDays('2026-09-13'), [
    '2026-09-13', '2026-09-14', '2026-09-15', '2026-09-16',
    '2026-09-17', '2026-09-18', '2026-09-19',
  ]);
});

test('addWeeks: 月をまたいで1週進む', () => {
  assert.equal(addWeeks('2026-09-27', 1), '2026-10-04');
});

test('addWeeks: 1週戻る', () => {
  assert.equal(addWeeks('2026-09-13', -1), '2026-09-06');
});

test('timeToMinutes: 14:20 -> 860', () => {
  assert.equal(timeToMinutes('14:20'), 860);
});

test('minutesToTop: 開始5時から14:20は448px', () => {
  assert.equal(minutesToTop(860, OPTS), 448);
});

test('minutesToTop: 5:00ちょうどは0px', () => {
  assert.equal(minutesToTop(300, OPTS), 0);
});

test('blockHeight: 14:00-15:30は72px', () => {
  assert.equal(blockHeight('14:00', '15:30', OPTS), 72);
});

test('blockHeight: 終了なしは既定60分=48px', () => {
  assert.equal(blockHeight('14:00', '', OPTS), 48);
});

test('blockHeight: 終了が開始より前なら既定60分扱い', () => {
  assert.equal(blockHeight('14:00', '13:00', OPTS), 48);
});

test('splitTimedAllDay: time有無で分割', () => {
  const evs = [
    { id: 'a', time: '10:00' },
    { id: 'b', time: '' },
    { id: 'c', time: '14:00' },
  ];
  const { timed, allDay } = splitTimedAllDay(evs);
  assert.deepEqual(timed.map((e) => e.id), ['a', 'c']);
  assert.deepEqual(allDay.map((e) => e.id), ['b']);
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npm test`
Expected: FAIL（`js/week.js` が無い）

- [ ] **Step 3: 最小実装を書く**

`js/week.js`:

```js
// 週・時刻の純粋計算。副作用なし。日付演算はUTC基準でタイムゾーン非依存。

const DAY_MS = 86400000;

function pad(n) { return String(n).padStart(2, '0'); }

function dateToUTC(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

function utcToDateStr(ms) {
  const dt = new Date(ms);
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

// その日付が属する週（日曜起点）の日曜の日付
export function weekStartSunday(dateStr) {
  const ms = dateToUTC(dateStr);
  const dow = new Date(ms).getUTCDay(); // 0=Sun
  return utcToDateStr(ms - dow * DAY_MS);
}

// 日曜起点の7日分
export function weekDays(weekStartStr) {
  const ms = dateToUTC(weekStartStr);
  const out = [];
  for (let i = 0; i < 7; i++) out.push(utcToDateStr(ms + i * DAY_MS));
  return out;
}

// 週起点を n 週ずらす
export function addWeeks(weekStartStr, n) {
  return utcToDateStr(dateToUTC(weekStartStr) + n * 7 * DAY_MS);
}

// 'HH:MM' -> 分
export function timeToMinutes(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

// 分 -> グリッド上部からのpxオフセット
export function minutesToTop(min, opts) {
  const { startHour, hourHeight } = opts;
  return ((min - startHour * 60) / 60) * hourHeight;
}

// ブロック高さpx。終了なしは既定60分。最小は30分相当。
export function blockHeight(startStr, endStr, opts) {
  const { hourHeight } = opts;
  const start = timeToMinutes(startStr);
  let dur = 60;
  if (endStr) {
    const end = timeToMinutes(endStr);
    dur = end > start ? end - start : 60;
  }
  return Math.max((dur / 60) * hourHeight, hourHeight * 0.5);
}

// 時刻あり/終日（time が空）に分割
export function splitTimedAllDay(events) {
  const timed = [];
  const allDay = [];
  for (const ev of events) {
    if (ev.time) timed.push(ev); else allDay.push(ev);
  }
  return { timed, allDay };
}
```

- [ ] **Step 4: テストを実行して成功を確認**

Run: `npm test`
Expected: PASS（既存13 + 新規12 = 25テスト全緑）

- [ ] **Step 5: コミット**

```bash
git add js/week.js tests/week.test.js
git commit -m "feat: pure week/time calculations for calendar grid"
```

---

## Task 2: 編集シート（editor.js）＋CSS

予定1件を編集するモーダル。リスト/週の両方から `openEditor(event|null, defaultDate)` で呼ぶ。
保存・削除で `store.update` を呼ぶ。

**Files:**
- Create: `js/editor.js`
- Modify: `css/styles.css`（末尾に追記）

- [ ] **Step 1: editor.js を作成**

`js/editor.js`:

```js
import { update } from './store.js';

const TYPES = [
  { value: 'flight', label: '移動' },
  { value: 'sightseeing', label: '観光' },
  { value: 'hotel', label: '宿泊' },
  { value: 'food', label: '食事' },
  { value: 'other', label: 'その他' },
];

let overlay = null;

function escapeAttr(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/"/g, '&quot;')
    .replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// event=null で新規。defaultDate は新規時の初期日付。
export function openEditor(event, defaultDate) {
  closeEditor();
  const isNew = !event;
  const ev = event || {
    id: 'e' + Date.now(),
    date: defaultDate || '2026-09-12',
    time: '', endTime: '', city: '', type: 'sightseeing', title: '', meals: {},
  };

  overlay = document.createElement('div');
  overlay.className = 'editor-overlay';
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeEditor(); });

  const sheet = document.createElement('div');
  sheet.className = 'editor-sheet';
  const typeOptions = TYPES.map((t) =>
    `<option value="${t.value}"${t.value === ev.type ? ' selected' : ''}>${t.label}</option>`).join('');

  sheet.innerHTML = `
    <h3 class="editor-title">${isNew ? '予定を追加' : '予定を編集'}</h3>
    <label class="editor-field">内容
      <input class="edit" id="ed-title" type="text" value="${escapeAttr(ev.title)}" placeholder="例: ルーブル美術館" />
    </label>
    <label class="editor-field">種別
      <select class="edit" id="ed-type">${typeOptions}</select>
    </label>
    <label class="editor-field">日付
      <input class="edit" id="ed-date" type="date" value="${ev.date}" />
    </label>
    <div class="editor-row">
      <label class="editor-field">開始
        <input class="edit" id="ed-time" type="time" value="${ev.time || ''}" />
      </label>
      <label class="editor-field">終了
        <input class="edit" id="ed-endtime" type="time" value="${ev.endTime || ''}" />
      </label>
    </div>
    <p class="editor-hint">開始を空にすると「終日」になります</p>
    <div class="editor-actions">
      <button class="btn-save" id="ed-save">保存</button>
      ${isNew ? '' : '<button class="btn-delete" id="ed-delete">削除</button>'}
      <button class="btn-cancel" id="ed-cancel">キャンセル</button>
    </div>
  `;

  overlay.appendChild(sheet);
  document.body.appendChild(overlay);

  sheet.querySelector('#ed-save').addEventListener('click', () => {
    const titleEl = sheet.querySelector('#ed-title');
    const title = titleEl.value.trim();
    if (!title) { titleEl.focus(); return; }
    const patch = {
      title,
      type: sheet.querySelector('#ed-type').value,
      date: sheet.querySelector('#ed-date').value,
      time: sheet.querySelector('#ed-time').value,
      endTime: sheet.querySelector('#ed-endtime').value,
    };
    update((s) => {
      const target = s.events.find((e) => e.id === ev.id);
      if (target) Object.assign(target, patch);
      else s.events.push({ ...ev, ...patch });
    });
    closeEditor();
  });

  const delBtn = sheet.querySelector('#ed-delete');
  if (delBtn) delBtn.addEventListener('click', () => {
    if (!confirm('この予定を削除しますか？')) return;
    update((s) => {
      const i = s.events.findIndex((e) => e.id === ev.id);
      if (i >= 0) s.events.splice(i, 1);
    });
    closeEditor();
  });

  sheet.querySelector('#ed-cancel').addEventListener('click', closeEditor);
}

function closeEditor() {
  if (overlay) { overlay.remove(); overlay = null; }
}
```

- [ ] **Step 2: css/styles.css の末尾に編集シートのスタイルを追記**

`css/styles.css` の末尾に追記:

```css
/* 編集シート */
.editor-overlay {
  position: fixed; inset: 0; z-index: 50;
  background: rgba(58, 47, 58, 0.4);
  display: flex; align-items: flex-end; justify-content: center;
}
.editor-sheet {
  background: #fff; width: 100%; max-width: 480px;
  border-radius: 22px 22px 0 0; padding: 18px 18px calc(18px + env(safe-area-inset-bottom));
  box-shadow: 0 -8px 30px rgba(0,0,0,0.18);
  animation: sheet-up 0.18s ease-out;
}
@keyframes sheet-up { from { transform: translateY(30px); opacity: 0.6; } to { transform: none; opacity: 1; } }
.editor-title { font-size: 1.05rem; margin-bottom: 10px; color: var(--pink); }
.editor-field { display: block; font-size: 0.8rem; color: var(--muted); margin-bottom: 8px; }
.editor-row { display: flex; gap: 10px; }
.editor-row .editor-field { flex: 1; }
.editor-hint { font-size: 0.75rem; color: var(--muted); margin: 2px 0 12px; }
.editor-actions { display: flex; gap: 8px; align-items: center; }
.editor-actions button { border: none; border-radius: 12px; padding: 10px 16px; font: inherit; cursor: pointer; }
.btn-save { background: var(--pink); color: #fff; font-weight: 700; flex: 1; }
.btn-delete { background: #fff; color: #d44; border: 1.5px solid #f3c0c0 !important; }
.btn-cancel { background: var(--pink-soft); color: var(--ink); }
```

- [ ] **Step 3: 構文チェック**

Run: `node --check js/editor.js`
Expected: exit 0

- [ ] **Step 4: コミット**

```bash
git add js/editor.js css/styles.css
git commit -m "feat: event editor sheet with date/time pickers"
```

---

## Task 3: 週グリッド表示（weekview.js）＋CSS

**Files:**
- Create: `js/weekview.js`
- Modify: `css/styles.css`（末尾に追記）

- [ ] **Step 1: weekview.js を作成**

`js/weekview.js`:

```js
import {
  weekStartSunday, weekDays, addWeeks,
  timeToMinutes, minutesToTop, blockHeight, splitTimedAllDay,
} from './week.js';
import { openEditor } from './editor.js';

const GRID = { startHour: 5, endHour: 26, hourHeight: 48 }; // 5:00〜翌2:00
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
      block.addEventListener('click', () => openEditor(ev));
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
```

- [ ] **Step 2: css/styles.css の末尾に週グリッドのスタイルを追記**

`css/styles.css` の末尾に追記:

```css
/* 週グリッド */
.week-nav { display: flex; align-items: center; justify-content: center; gap: 10px; flex-wrap: wrap; margin: 6px 0 10px; }
.week-label { font-weight: 700; color: var(--pink); font-size: 0.95rem; }
.week-scroller { overflow-x: auto; -webkit-overflow-scrolling: touch; border-radius: 14px; background: #fff; box-shadow: var(--shadow); }
.week-grid { display: flex; min-width: 760px; }
.week-axis { flex: 0 0 46px; position: sticky; left: 0; z-index: 2; background: #fff; }
.axis-corner { height: 40px; }
.axis-allday { height: 30px; border-bottom: 1px solid var(--pink-soft); }
.axis-hour { font-size: 0.65rem; color: var(--muted); text-align: right; padding-right: 4px; box-sizing: border-box; border-top: 1px solid #f3eef1; }
.week-col { flex: 1 1 0; min-width: 92px; border-left: 1px solid #f3eef1; }
.col-head { height: 40px; display: flex; flex-direction: column; align-items: center; justify-content: center; line-height: 1.1; }
.col-head .dow { font-size: 0.7rem; color: var(--muted); }
.col-head .dom { font-size: 1rem; font-weight: 700; }
.col-head.in-trip { background: var(--pink-soft); }
.col-head.in-trip .dom { color: var(--pink); }
.col-allday { height: 30px; overflow: hidden; border-bottom: 1px solid var(--pink-soft); padding: 2px; }
.allday-chip { display: block; width: 100%; border: none; border-radius: 6px; font-size: 0.62rem; padding: 2px 4px; margin-bottom: 2px; text-align: left; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor: pointer; color: #fff; }
.col-body { position: relative; }
.hour-line { position: absolute; left: 0; right: 0; border-top: 1px solid #f3eef1; }
.event-block { position: absolute; border: none; border-radius: 6px; color: #fff; font-size: 0.6rem; padding: 2px 3px; overflow: hidden; text-align: left; cursor: pointer; box-shadow: 0 1px 3px rgba(0,0,0,0.15); }
.event-block .bk-time { display: block; font-weight: 700; }
.event-block .bk-title { display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
/* 種別色（チップ＆ブロック共通） */
.allday-chip.flight, .event-block.flight { background: var(--sky); }
.allday-chip.sightseeing, .event-block.sightseeing { background: var(--pink); }
.allday-chip.hotel, .event-block.hotel { background: var(--mint); }
.allday-chip.food, .event-block.food { background: var(--lemon); color: #7a5b00; }
.allday-chip.other, .event-block.other { background: #c08cff; }
```

- [ ] **Step 3: 構文チェック**

Run: `node --check js/weekview.js`
Expected: exit 0

- [ ] **Step 4: コミット**

```bash
git add js/weekview.js css/styles.css
git commit -m "feat: Google-Calendar-style week grid view"
```

---

## Task 4: timeline.js 全面改訂（トグル＋リスト＋FAB、prompt廃止）＋CSS

**Files:**
- Modify: `js/timeline.js`（全置換）
- Modify: `css/styles.css`（末尾にトグルのスタイル追記）

- [ ] **Step 1: timeline.js を全置換**

`js/timeline.js` を以下で**全置換**:

```js
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
  fab.addEventListener('click', () => openEditor(null, firstDate));
  root.appendChild(fab);

  function setView(v) {
    saveView(v);
    toggle.querySelectorAll('.toggle-btn').forEach((b) =>
      b.classList.toggle('is-active', b.dataset.view === v));
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
    (mealLabel(ev.meals) ? `<div class="meta">${mealLabel(ev.meals)}</div>` : '');

  el.addEventListener('click', () => openEditor(ev));
  return el;
}
```

- [ ] **Step 2: css/styles.css の末尾にトグルのスタイルを追記**

`css/styles.css` の末尾に追記:

```css
/* 表示切替トグル */
.view-toggle { display: inline-flex; background: var(--pink-soft); border-radius: 999px; padding: 3px; margin: 0 0 6px; }
.toggle-btn { border: none; background: none; padding: 6px 18px; border-radius: 999px; font: inherit; color: var(--muted); cursor: pointer; }
.toggle-btn.is-active { background: #fff; color: var(--pink); font-weight: 700; box-shadow: 0 1px 4px rgba(0,0,0,0.08); }
```

- [ ] **Step 3: 構文チェック＆全テスト**

Run: `node --check js/timeline.js && npm test`
Expected: 構文OK、テスト25件全パス

- [ ] **Step 4: コミット**

```bash
git add js/timeline.js css/styles.css
git commit -m "feat: list/week view toggle, FAB, editor sheet (replace prompt edits)"
```

---

## Task 5: ブラウザ実機確認（Playwright）

**Files:** なし（検証のみ）

- [ ] **Step 1: ローカルサーバを起動**

検証用の簡易サーバを起動（ES Modules は file:// 不可）。プロジェクト直下に一時サーバを置いて起動:

```bash
node -e "const h=require('http'),f=require('fs'),p=require('path'),r=process.cwd(),t={'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json'};h.createServer((q,s)=>{let u=decodeURIComponent(q.url.split('?')[0]);if(u==='/')u='/index.html';const fp=p.join(r,u);f.readFile(fp,(e,d)=>{if(e){s.writeHead(404);s.end();return;}s.writeHead(200,{'Content-Type':(t[p.extname(fp)]||'application/octet-stream')+'; charset=utf-8'});s.end(d);});}).listen(5180,()=>console.log('up'));" &
```

Run: `sleep 2 && curl -s -o /dev/null -w "%{http_code}" http://localhost:5180/index.html`
Expected: `200`

- [ ] **Step 2: Playwright で機能確認**

`http://localhost:5180/?trip=test-week-001` を開き、以下を確認:
1. 旅程タブ上部に [リスト｜週] トグルがあり、既定はリスト
2. 「週」をタップ → Googleカレンダー風の7列グリッド表示。初期表示は9/12を含む週（9/6〜9/12）。「次の週 ›」で9/13〜9/19週へ移動でき、ロンドン観光が「終日」行、ユーロスター11:00やパリ着が時間ブロックで表示される
3. 時間ブロック（例: 9/15 ユーロスター 11:00）をタップ → 編集シートが開く。開始時刻を `09:00` に変更して保存 → ブロックが上に移動する
4. 「リスト」に戻すと、同じ予定の時刻が 09:00 に反映されている
5. リロードしても「週」表示が保持される（localStorage）

各確認でスクリーンショットを撮る。

- [ ] **Step 3: スマホ幅で横スクロール確認**

ビューポートを 390x844 にして「週」表示を開き、グリッドが横スクロールでき、時刻軸が左に固定され7列すべて閲覧できることをスクリーンショットで確認。

- [ ] **Step 4: Firestore同期の確認**

同じ `?trip=test-week-001` を2タブで開き、一方の「週」表示で予定をタップ→時刻変更→保存。もう一方（リロードなし）に反映されることを確認（既存の同期が編集シート経由でも効くこと）。

- [ ] **Step 5: 問題があれば修正してコミット**

```bash
git add -A
git commit -m "fix: adjustments from week-view browser verification"
```
（修正が無ければスキップ）

- [ ] **Step 6: サーバ停止・一時ファイル削除**

検証で作った一時ファイルがあれば削除し、ポート5180のプロセスを停止する。

---

## Task 6: 公開（main へ反映 → GitHub Pages 自動更新）

**Files:** なし（デプロイ）

- [ ] **Step 1: main へ反映して push**

```bash
git push origin main
```
（既に main 上で作業しているため、コミットを push すれば GitHub Pages が自動再ビルドされる）

- [ ] **Step 2: 公開URLで最終確認**

1〜2分後、`https://gfd-creators.github.io/honeymoon-planner/` を開き、[リスト｜週] トグルと週グリッド・編集シートが動作することをスクリーンショットで確認。コンソールに favicon 以外のエラーが出ないこと。

---

## Self-Review メモ（spec 対応確認）

- [リスト｜週] トグル・選択保持 → Task 4（VIEW_KEY localStorage）
- 週グリッド（日〜土7列・時刻軸・前後ナビ・初期9/12週）→ Task 3
- 時刻あり=ブロック / 終日=上部行 → Task 3（splitTimedAllDay, col-allday/col-body）
- スマホ横スクロール（時刻軸固定）→ Task 3 CSS（.week-scroller overflow-x, .week-axis sticky）→ Task 5 Step 3 で検証
- タップ編集シート（日付/時刻ピッカー・種別・削除）→ Task 2
- prompt廃止・リスト/週両方で編集シート → Task 4（eventCard→openEditor）, Task 3（block/chip→openEditor）
- endTime 任意追加・後方互換 → Task 2（editor が endTime を保存）, Task 1（blockHeight が end無対応）
- 週計算の単体テスト → Task 1
- Firestore同期維持 → store.update を経由（変更なし）, Task 5 Step 4 で検証

全 spec 要件にタスク対応。プレースホルダ無し。関数名整合（weekStartSunday/weekDays/addWeeks/timeToMinutes/minutesToTop/blockHeight/splitTimedAllDay/openEditor/renderWeekView/renderTimeline）一貫。
