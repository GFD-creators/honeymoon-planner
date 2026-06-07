# 週タブの旅行期間ページ化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 週タブを日〜土カレンダー週から出発日(9/12)起点の旅行ページ（9/12〜9/18 / 9/19〜9/23）に変え、期間外の週へ移動できないようにする。

**Architecture:** 日付計算（addDays/weekdayIndex/daysBetween）を純粋関数として `week.js` に追加し単体テスト。`weekview.js` のモジュール状態を `currentWeekStart`（日曜起点）から `currentPage`（0始まり）に置き換え、旅行範囲からページの日付配列とナビ可否を計算する。

**Tech Stack:** Vanilla JS (ES Modules), Node 組み込みテスト (`node --test`), GitHub Pages。

---

## ファイル構成

```
js/
├ week.js     — 変更。addDays / weekdayIndex / daysBetween 追加（純粋・テスト対象）
├ weekview.js — 変更（全置換）。currentPage 方式、ナビ制限、実曜日表示
css/styles.css — 追加（ナビ無効ボタンのスタイル1行）
tests/
└ week.test.js — 変更。追加関数のテスト
```

`editor.js` / `drag.js` / `store.js` / `timeline.js` / `places.js` / `link.js` / `seed.js` は変更しない。

---

## Task 1: week.js に日付ユーティリティを追加（TDD）

**Files:**
- Modify: `js/week.js`（末尾に関数追加）
- Modify: `tests/week.test.js`（import 更新＋テスト追加）

- [ ] **Step 1: 失敗するテストを追記**

`tests/week.test.js` 先頭の import を以下に置き換える（既存の名前に3つ追加）:

```js
import {
  weekStartSunday, weekDays, addWeeks,
  timeToMinutes, minutesToTop, blockHeight, splitTimedAllDay,
  snapMinutes, topToMinutes, minutesToTime,
  addDays, weekdayIndex, daysBetween,
} from '../js/week.js';
```

ファイル末尾に追記:

```js
test('addDays: 月をまたいで+1', () => {
  assert.equal(addDays('2026-09-30', 1), '2026-10-01');
});

test('addDays: 負・+7', () => {
  assert.equal(addDays('2026-09-12', -1), '2026-09-11');
  assert.equal(addDays('2026-09-12', 7), '2026-09-19');
});

test('weekdayIndex: 9/12は土(6)、9/13は日(0)', () => {
  assert.equal(weekdayIndex('2026-09-12'), 6);
  assert.equal(weekdayIndex('2026-09-13'), 0);
  assert.equal(weekdayIndex('2026-09-19'), 6);
});

test('daysBetween: 9/12→9/23は11、同日0、逆順は負', () => {
  assert.equal(daysBetween('2026-09-12', '2026-09-23'), 11);
  assert.equal(daysBetween('2026-09-12', '2026-09-12'), 0);
  assert.equal(daysBetween('2026-09-23', '2026-09-12'), -11);
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npm test`
Expected: FAIL（addDays 等が未定義）

- [ ] **Step 3: week.js に実装を追記**

`js/week.js` の末尾に追記:

```js
// 日付を n 日進める（負も可）
export function addDays(dateStr, n) {
  return utcToDateStr(dateToUTC(dateStr) + n * DAY_MS);
}

// 曜日番号 0=日 … 6=土
export function weekdayIndex(dateStr) {
  return new Date(dateToUTC(dateStr)).getUTCDay();
}

// end - start の日数差（整数）
export function daysBetween(startStr, endStr) {
  return Math.round((dateToUTC(endStr) - dateToUTC(startStr)) / DAY_MS);
}
```

- [ ] **Step 4: テストを実行して成功を確認**

Run: `npm test`
Expected: PASS（既存35 + 新規4 = 39テスト全緑）

- [ ] **Step 5: コミット**

```bash
git add js/week.js tests/week.test.js
git commit -m "feat: addDays/weekdayIndex/daysBetween date utilities"
```

---

## Task 2: weekview.js をページ方式に置換＋CSS

**Files:**
- Modify: `js/weekview.js`（全置換）
- Modify: `css/styles.css`（末尾に追記）

- [ ] **Step 1: weekview.js を全置換**

`js/weekview.js` を以下で全置換:

```js
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
```

- [ ] **Step 2: css/styles.css の末尾に無効ナビのスタイルを追記**

`css/styles.css` の末尾に追記:

```css
/* 週ナビの無効ボタン（端） */
.week-nav .link.is-disabled { opacity: 0.3; pointer-events: none; }
```

- [ ] **Step 3: 構文チェック＆全テスト**

Run: `node --check js/weekview.js && npm test`
Expected: 構文OK、テスト39件全パス

- [ ] **Step 4: コミット**

```bash
git add js/weekview.js css/styles.css
git commit -m "feat: trip-bounded week pages (9/12 start) with nav limits"
```

---

## Task 3: ブラウザ実機確認（Playwright）

**Files:** なし（検証のみ）

- [ ] **Step 1: ローカルサーバ起動**

プロジェクト直下に `tmp-server.cjs` を作成して起動:

```js
const http=require('http'),fs=require('fs'),path=require('path'),root=__dirname;
const t={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8'};
http.createServer((q,s)=>{let u=decodeURIComponent(q.url.split('?')[0]);if(u==='/')u='/index.html';const fp=path.join(root,u);if(!fp.startsWith(root)){s.writeHead(403);s.end();return;}fs.readFile(fp,(e,d)=>{if(e){s.writeHead(404);s.end();return;}s.writeHead(200,{'Content-Type':t[path.extname(fp)]||'application/octet-stream'});s.end(d);});}).listen(5180,()=>console.log('up'));
```

`curl -s -o /dev/null -w "%{http_code}" http://localhost:5180/index.html` が `200`。

- [ ] **Step 2: 初期ページ・曜日・ページ数を確認**

`http://localhost:5180/?trip=test-pages-001` を開き、週表示に切替。`browser_evaluate` で確認:
- ラベルが「09/12 〜 09/18」
- 列数（`.week-col`）が 7、先頭列の曜日が「土」、`.col-body` の dataset.date が 09-12..09-18
- 「‹ 前」が `is-disabled`（先頭）
発火例:

```js
() => {
  document.querySelector('.toggle-btn[data-view="week"]').click();
  const label = document.querySelector('.week-label').textContent;
  const cols = [...document.querySelectorAll('.col-body')].map((b) => b.dataset.date);
  const firstDow = document.querySelector('.col-head .dow').textContent;
  const prevDisabled = document.querySelector('.week-nav .link').classList.contains('is-disabled');
  return { label, cols, firstDow, prevDisabled };
};
```

- [ ] **Step 3: 次ページ＝5列・末尾無効を確認**

「次 ›」をクリック→ラベル「09/19 〜 09/23」、`.week-col` が 5、先頭曜日「土」(9/19)、「次 ›」が `is-disabled`、「‹ 前」が有効。クリックしてもそれ以上進まないこと。

- [ ] **Step 4: 既存機能の維持を確認**

ページ1で、時刻ブロック（ユーロスター等は無いので任意の予定）のドラッグ移動・空きマスタップ作成が従来どおり動くことを1つずつ確認（pointer/click を `browser_evaluate` で発火）。

- [ ] **Step 5: 問題があれば修正してコミット**

```bash
git add -A
git commit -m "fix: adjustments from week-pages verification"
```
（修正が無ければスキップ）

- [ ] **Step 6: サーバ停止・一時ファイル削除**

`tmp-server.cjs` を削除し、ポート5180のプロセスを停止する。

---

## Task 4: 公開（main へ反映 → GitHub Pages 自動更新）

**Files:** なし（デプロイ）

- [ ] **Step 1: push**

```bash
git push origin main
```

- [ ] **Step 2: 本番で最終確認**

1〜2分後、`https://gfd-creators.github.io/honeymoon-planner/` を開き、週タブが 09/12〜09/18 で始まり、2ページだけ行き来できることを確認。`js/weekview.js` の更新が配信される（`currentPage` を含む）まで待つ。コンソールに favicon 以外のエラーが出ないこと。

---

## Self-Review メモ（spec 対応確認）

- 出発日起点の7日ページ（9/12〜9/18 / 9/19〜9/23、末でクランプ）→ Task 2（pageStart/pageEnd/days）
- 実曜日見出し → Task 2（WEEKDAYS[weekdayIndex(d)]）
- ナビを2ページ内に制限・端で無効 → Task 2（navBtn disabled, lastPage クランプ）
- 初期ページ1 → Task 2（currentPage 初期0）
- 「旅程の週へ」削除 → Task 2（nav から除外）
- 既存機能維持（ドラッグ・空きマス・編集・終日・横スクロール）→ Task 2（該当コードを保持）
- 日付ユーティリティの単体テスト → Task 1

全 spec 要件にタスク対応。プレースホルダ無し。関数名整合（addDays/weekdayIndex/daysBetween、currentPage/lastPage、navBtn(text,disabled,onClick)）一貫。
Note: spec §4 は「css 変更なし」だが、§6 のナビ無効「見た目を薄く」を満たすため `.is-disabled` の1行のみ追加する（軽微）。
