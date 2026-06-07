# 旅程への直接入力＋行き先連動 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 週グリッドの空き時間タップで予定を直接作成でき、行き先に日時を設定すると旅程に予定が自動生成・リンクされ双方向で一致するようにする。

**Architecture:** 予定（event）を唯一のデータソースとし、行き先（sight）は `eventId` でリンクするだけ（リンク解決は純粋関数 `link.js`、単体テスト）。`editor.js` の `openEditor` を拡張（初期値＋保存後コールバック）して、空きマス作成・行き先連動の両方から共通利用する。

**Tech Stack:** Vanilla JS (ES Modules), Pointer/Click events, Node 組み込みテスト (`node --test`), GitHub Pages。

---

## ファイル構成

```
js/
├ link.js       — 新規。行き先↔予定のリンク解決（純粋・テスト対象）
├ editor.js     — 変更。openEditor(event, opts) に拡張（後方互換あり）
├ weekview.js   — 変更。空きマス click で作成
├ timeline.js   — 変更。リスト各日ヘッダに＋、FAB を opts 形式へ
├ places.js     — 変更。行き先に追加/編集/解除、リンク先予定の日時表示
css/styles.css  — 追加（日ヘッダ＋ / 行き先の日時バッジ・ボタン）
tests/
└ link.test.js  — 新規。link.js の単体テスト
```

`store.js` / `seed.js` / `week.js` / `drag.js` は変更しない。

---

## Task 1: link.js（リンク解決）TDD

**Files:**
- Create: `js/link.js`
- Test: `tests/link.test.js`

- [ ] **Step 1: 失敗するテストを書く**

`tests/link.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findLinkedEvent, isScheduled } from '../js/link.js';

const events = [
  { id: 'e1', title: 'A' },
  { id: 'e2', title: 'B' },
];

test('findLinkedEvent: eventId 一致で event を返す', () => {
  assert.equal(findLinkedEvent(events, { name: 'x', eventId: 'e2' }).title, 'B');
});

test('findLinkedEvent: 一致しない eventId は null', () => {
  assert.equal(findLinkedEvent(events, { name: 'x', eventId: 'zzz' }), null);
});

test('findLinkedEvent: eventId 未設定は null', () => {
  assert.equal(findLinkedEvent(events, { name: 'x' }), null);
});

test('isScheduled: リンク先があれば true', () => {
  assert.equal(isScheduled(events, { eventId: 'e1' }), true);
  assert.equal(isScheduled(events, { eventId: 'zzz' }), false);
  assert.equal(isScheduled(events, {}), false);
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npm test`
Expected: FAIL（`js/link.js` が無い）

- [ ] **Step 3: 実装を書く**

`js/link.js`:

```js
// 行き先（sight）↔ 予定（event）のリンク解決。純粋関数。
export function findLinkedEvent(events, sight) {
  if (!sight || !sight.eventId) return null;
  return events.find((e) => e.id === sight.eventId) || null;
}

export function isScheduled(events, sight) {
  return findLinkedEvent(events, sight) != null;
}
```

- [ ] **Step 4: テストを実行して成功を確認**

Run: `npm test`
Expected: PASS（既存28 + 新規4 = 32テスト全緑）

- [ ] **Step 5: コミット**

```bash
git add js/link.js tests/link.test.js
git commit -m "feat: sight<->event link resolution helpers"
```

---

## Task 2: editor.js を opts 形式に拡張（後方互換）

**Files:**
- Modify: `js/editor.js`（全置換）

- [ ] **Step 1: editor.js を全置換**

`js/editor.js` を以下で全置換:

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

// event=null で新規。opts = { defaultDate, defaultTime, prefill:{title,city,type}, onSaved(id,isNew) }。
// 後方互換: opts が文字列なら defaultDate として扱う。
export function openEditor(event, opts) {
  closeEditor();
  const o = typeof opts === 'string' ? { defaultDate: opts } : (opts || {});
  const pre = o.prefill || {};
  const isNew = !event;
  const ev = event || {
    id: 'e' + Date.now(),
    date: o.defaultDate || '2026-09-12',
    time: o.defaultTime || '',
    endTime: '',
    city: pre.city || '',
    type: pre.type || 'sightseeing',
    title: pre.title || '',
    meals: {},
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
    if (o.onSaved) o.onSaved(ev.id, isNew);
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

- [ ] **Step 2: 構文チェック＆全テスト**

Run: `node --check js/editor.js && npm test`
Expected: 構文OK、テスト32件全パス（既存呼び出し `openEditor(ev)` / `openEditor(null, firstDate)` は後方互換で動作）

- [ ] **Step 3: コミット**

```bash
git add js/editor.js
git commit -m "feat: openEditor opts (defaultTime/prefill/onSaved) with back-compat"
```

---

## Task 3: weekview.js 空きマスタップで作成

**Files:**
- Modify: `js/weekview.js`

- [ ] **Step 1: import に時刻ヘルパを追加**

`js/weekview.js` 先頭の week.js import を以下に変更。
変更前:

```js
import {
  weekStartSunday, weekDays, addWeeks,
  timeToMinutes, minutesToTop, blockHeight, splitTimedAllDay,
} from './week.js';
```

変更後:

```js
import {
  weekStartSunday, weekDays, addWeeks,
  timeToMinutes, minutesToTop, blockHeight, splitTimedAllDay,
  snapMinutes, topToMinutes, minutesToTime,
} from './week.js';
```

- [ ] **Step 2: col-body に空きマス作成の click を追加**

`renderWeekView` 内、`body.dataset.date = d;` と `body.style.height = ...` の直後（時間目盛り線ループの前）に追加。
変更前:

```js
    body.dataset.date = d;
    body.style.height = (GRID.endHour - GRID.startHour) * GRID.hourHeight + 'px';
    for (let h = GRID.startHour; h < GRID.endHour; h++) {
```

変更後:

```js
    body.dataset.date = d;
    body.style.height = (GRID.endHour - GRID.startHour) * GRID.hourHeight + 'px';
    body.addEventListener('click', (e) => {
      if (e.target.closest('.event-block')) return; // ブロック上は従来の編集
      const top = body.getBoundingClientRect().top;
      const min = snapMinutes(topToMinutes(e.clientY - top, GRID), 30);
      openEditor(null, { defaultDate: d, defaultTime: minutesToTime(min) });
    });
    for (let h = GRID.startHour; h < GRID.endHour; h++) {
```

- [ ] **Step 3: 構文チェック＆全テスト**

Run: `node --check js/weekview.js && npm test`
Expected: 構文OK、テスト32件全パス

- [ ] **Step 4: コミット**

```bash
git add js/weekview.js
git commit -m "feat: tap empty grid cell to create event at that day/time"
```

---

## Task 4: timeline.js リスト各日ヘッダに＋／FAB を opts 形式へ

**Files:**
- Modify: `js/timeline.js`
- Modify: `css/styles.css`（末尾に追記）

- [ ] **Step 1: FAB を opts 形式に変更**

`js/timeline.js` の FAB クリック部を変更。
変更前:

```js
  fab.addEventListener('click', () => openEditor(null, firstDate));
```

変更後:

```js
  fab.addEventListener('click', () => openEditor(null, { defaultDate: firstDate }));
```

- [ ] **Step 2: renderList の各日ヘッダに＋ボタンを追加**

`renderList` 内の日付ヘッダ生成部を変更。
変更前:

```js
  for (const date of dates) {
    const head = document.createElement('div');
    head.className = 'day-head';
    head.innerHTML =
      `<span class="date">${date.slice(5).replace('-', '/')}</span>` +
      `<span class="weekday">(${weekdayOf(date)})</span>`;
    root.appendChild(head);
```

変更後:

```js
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
```

- [ ] **Step 3: css/styles.css の末尾に日ヘッダ＋のスタイルを追記**

`css/styles.css` の末尾に追記:

```css
/* リスト日ヘッダの追加ボタン */
.add-day {
  margin-left: auto; border: none; background: var(--pink-soft); color: var(--pink);
  width: 24px; height: 24px; border-radius: 50%; font-size: 1rem; line-height: 1; cursor: pointer;
}
```

- [ ] **Step 4: 構文チェック＆全テスト**

Run: `node --check js/timeline.js && npm test`
Expected: 構文OK、テスト32件全パス

- [ ] **Step 5: コミット**

```bash
git add js/timeline.js css/styles.css
git commit -m "feat: per-day add button in list view, FAB opts form"
```

---

## Task 5: places.js 行き先連動

**Files:**
- Modify: `js/places.js`（全置換）
- Modify: `css/styles.css`（末尾に追記）

- [ ] **Step 1: places.js を全置換**

`js/places.js` を以下で全置換:

```js
import { update } from './store.js';
import { openEditor } from './editor.js';
import { findLinkedEvent } from './link.js';

export function renderPlaces(root, state) {
  for (const city of state.cities) {
    const card = document.createElement('div');
    card.className = 'card';
    const doneCount = city.sights.filter((s) => s.done).length;
    card.innerHTML =
      `<div class="day-head" style="margin:0 0 6px">` +
      `<span class="date">${city.name}</span>` +
      `<span class="weekday">${city.days}・${doneCount}/${city.sights.length} 達成</span></div>`;

    city.sights.forEach((sight, i) => {
      const row = document.createElement('div');
      row.className = 'sight' + (sight.done ? ' done' : '');

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = sight.done;
      cb.id = `${city.name}-${i}`;
      cb.addEventListener('change', () => {
        update((s) => {
          const c = s.cities.find((x) => x.name === city.name);
          if (c) c.sights[i].done = cb.checked;
        });
      });
      const label = document.createElement('label');
      label.setAttribute('for', cb.id);
      label.textContent = sight.name;
      row.appendChild(cb);
      row.appendChild(label);

      const actions = document.createElement('div');
      actions.className = 'sight-actions';
      const linked = findLinkedEvent(state.events, sight);

      if (linked) {
        const when = linked.time
          ? `${linked.date.slice(5).replace('-', '/')} ${linked.time}`
          : `${linked.date.slice(5).replace('-', '/')} 終日`;
        const sched = document.createElement('button');
        sched.className = 'sight-schedule';
        sched.textContent = `🗓 ${when}`;
        sched.addEventListener('click', () => openEditor(linked));

        const unlink = document.createElement('button');
        unlink.className = 'sight-unlink';
        unlink.textContent = '解除';
        unlink.addEventListener('click', () => {
          update((s) => {
            const c = s.cities.find((x) => x.name === city.name);
            const sgt = c && c.sights[i];
            if (sgt && sgt.eventId) {
              const idx = s.events.findIndex((e) => e.id === sgt.eventId);
              if (idx >= 0) s.events.splice(idx, 1);
              delete sgt.eventId;
            }
          });
        });
        actions.append(sched, unlink);
      } else {
        if (sight.eventId) {
          // リンク切れ：stale な eventId を遅延クリア（再描画の再入を避ける）
          Promise.resolve().then(() => {
            update((s) => {
              const c = s.cities.find((x) => x.name === city.name);
              const sgt = c && c.sights[i];
              if (sgt && sgt.eventId && !s.events.some((e) => e.id === sgt.eventId)) delete sgt.eventId;
            });
          });
        }
        const addBtn = document.createElement('button');
        addBtn.className = 'sight-add';
        addBtn.textContent = '🗓 旅程に追加';
        addBtn.addEventListener('click', () => {
          openEditor(null, {
            defaultDate: state.meta?.startDate || '2026-09-12',
            defaultTime: '10:00',
            prefill: { title: sight.name, city: city.name, type: 'sightseeing' },
            onSaved: (id) => update((s) => {
              const c = s.cities.find((x) => x.name === city.name);
              if (c && c.sights[i]) c.sights[i].eventId = id;
            }),
          });
        });
        actions.appendChild(addBtn);
      }
      row.appendChild(actions);
      card.appendChild(row);
    });

    const add = document.createElement('button');
    add.className = 'link';
    add.textContent = '＋ 行きたい場所を追加';
    add.addEventListener('click', () => {
      const name = prompt(`${city.name}で行きたい場所`, '');
      if (!name) return;
      update((s) => {
        const c = s.cities.find((x) => x.name === city.name);
        if (c) c.sights.push({ name, done: false });
      });
    });
    card.appendChild(add);
    root.appendChild(card);
  }
}
```

- [ ] **Step 2: css/styles.css の末尾に行き先連動のスタイルを追記**

`css/styles.css` の末尾に追記:

```css
/* 行き先の旅程連動 */
.sight-actions { margin-left: auto; display: flex; align-items: center; gap: 6px; }
.sight-schedule { border: none; background: var(--sky-soft); color: #2b7fb8; font-size: 0.72rem; padding: 3px 8px; border-radius: 999px; cursor: pointer; white-space: nowrap; }
.sight-add { border: none; background: none; color: var(--pink); font-size: 0.72rem; cursor: pointer; white-space: nowrap; }
.sight-unlink { border: none; background: none; color: var(--muted); font-size: 0.72rem; cursor: pointer; }
```

- [ ] **Step 3: 構文チェック＆全テスト**

Run: `node --check js/places.js && npm test`
Expected: 構文OK、テスト32件全パス

- [ ] **Step 4: コミット**

```bash
git add js/places.js css/styles.css
git commit -m "feat: schedule places into itinerary with maintained link"
```

---

## Task 6: ブラウザ実機確認（Playwright）

**Files:** なし（検証のみ）

- [ ] **Step 1: ローカルサーバ起動**

プロジェクト直下に `tmp-server.cjs` を作成して起動:

```js
const http=require('http'),fs=require('fs'),path=require('path'),root=__dirname;
const t={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8'};
http.createServer((q,s)=>{let u=decodeURIComponent(q.url.split('?')[0]);if(u==='/')u='/index.html';const fp=path.join(root,u);if(!fp.startsWith(root)){s.writeHead(403);s.end();return;}fs.readFile(fp,(e,d)=>{if(e){s.writeHead(404);s.end();return;}s.writeHead(200,{'Content-Type':t[path.extname(fp)]||'application/octet-stream'});s.end(d);});}).listen(5180,()=>console.log('up'));
```

`curl -s -o /dev/null -w "%{http_code}" http://localhost:5180/index.html` が `200`。

- [ ] **Step 2: 空きマス作成を確認**

`http://localhost:5180/?trip=test-inline-001` を開き、週表示で「次の週 ›」（9/13〜9/19）。`browser_evaluate` で col-body の空き位置に click を発火し、編集シートが日付＝その列・開始時刻＝タップ位置（30分スナップ）で開くことを確認。タイトルを入れて保存→週グリッドにブロックが増えることを確認。発火例:

```js
() => {
  const body = [...document.querySelectorAll('.col-body')].find((b) => b.dataset.date === '2026-09-16');
  const r = body.getBoundingClientRect();
  body.dispatchEvent(new MouseEvent('click', { clientX: r.left + 10, clientY: r.top + 480, bubbles: true }));
  const sheet = document.querySelector('.editor-sheet');
  return { date: sheet.querySelector('#ed-date').value, time: sheet.querySelector('#ed-time').value };
};
```

- [ ] **Step 3: リスト日ヘッダ＋を確認**

リスト表示に切替、`.add-day` をクリック→編集シートがその日付で開くことを確認（スクリーンショット）。

- [ ] **Step 4: 行き先連動を確認**

行き先タブで、ある見どころ（例: 大英博物館）の「🗓 旅程に追加」をクリック→編集シートで日付・時刻を設定し保存→
- 行き先行に「🗓 M/D HH:MM」バッジが出る
- 旅程（週/リスト）にその観光予定が出る（ロンドンなので時差 🇯🇵 併記）
をスクリーンショットで確認。

- [ ] **Step 5: 双方向一致と解除を確認**

- 追加した予定を旅程側でドラッグ移動 → 行き先のバッジ日時も変わることを確認
- 行き先「解除」→ 旅程からその予定が消え、行き先が「🗓 旅程に追加」に戻ることを確認

- [ ] **Step 6: Firestore同期を確認**

同じ `?trip=test-inline-001` を2タブで開き、一方で「旅程に追加」した予定がもう一方（リロードなし）に反映されることを確認。

- [ ] **Step 7: 問題があれば修正してコミット**

```bash
git add -A
git commit -m "fix: adjustments from inline-create/place-link verification"
```
（修正が無ければスキップ）

- [ ] **Step 8: サーバ停止・一時ファイル削除**

`tmp-server.cjs` を削除し、ポート5180のプロセスを停止する。

---

## Task 7: 公開（main へ反映 → GitHub Pages 自動更新）

**Files:** なし（デプロイ）

- [ ] **Step 1: push**

```bash
git push origin main
```

- [ ] **Step 2: 本番で最終確認**

1〜2分後、`https://gfd-creators.github.io/honeymoon-planner/` を開き、空きマス作成・行き先連動が動作することを確認。`js/link.js` が配信される（HTTP 200）まで待ってから確認。コンソールに favicon 以外のエラーが出ないこと。

---

## Self-Review メモ（spec 対応確認）

- 週グリッド空きマスタップで作成（日付＋30分スナップ時刻）→ Task 3
- リスト各日ヘッダに＋ → Task 4、FAB を opts 形式へ → Task 4 Step 1
- 行き先「旅程に追加」→予定生成＋リンク（city でタイムゾーン）→ Task 5（onSaved で eventId 保存）
- 追加済み表示はリンク先 event から日時を読む（双方向一致）→ Task 5（findLinkedEvent）
- 解除でリンク先 event 削除＋eventId クリア → Task 5
- リンク切れの stale クリア（遅延・再入回避）→ Task 5
- editor 拡張（defaultDate/defaultTime/prefill/onSaved、後方互換）→ Task 2
- リンク解決の単体テスト → Task 1
- データ後方互換（eventId 未設定で動作）→ Task 1（null 返し）, Task 5（未リンク表示）

全 spec 要件にタスク対応。プレースホルダ無し。関数名整合（findLinkedEvent/isScheduled/openEditor の opts(defaultDate,defaultTime,prefill,onSaved)/snapMinutes/topToMinutes/minutesToTime）一貫。
