# 行き先の削除（都市・見どころ）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 行き先タブで都市カード・個々の見どころを削除でき、リンク済みの見どころ／都市を消すときはリンク先の旅程予定も併せて削除する。

**Architecture:** リンクID収集は純粋関数 `linkedEventIds` を `link.js` に追加し単体テスト。削除UIと処理は `places.js` に集約し、`store.update` で `cities`/`events` を更新する。

**Tech Stack:** Vanilla JS (ES Modules), Node 組み込みテスト (`node --test`), GitHub Pages。

---

## ファイル構成

```
js/
├ link.js     — 変更。linkedEventIds(sights) 追加（純粋・テスト対象）
├ places.js   — 変更（全置換）。都市削除🗑・見どころ削除✕
css/styles.css — 追加（削除ボタン）
tests/
└ link.test.js — 変更。linkedEventIds のテスト追加
```

`store.js` / `editor.js` / `weekview.js` / `timeline.js` / `week.js` / `drag.js` / `seed.js` は変更しない。

---

## Task 1: link.js に linkedEventIds を追加（TDD）

**Files:**
- Modify: `js/link.js`（末尾に関数追加）
- Modify: `tests/link.test.js`（import 更新＋テスト追加）

- [ ] **Step 1: 失敗するテストを追記**

`tests/link.test.js` 先頭の import 行を以下に置き換える:

```js
import { findLinkedEvent, isScheduled, linkedEventIds } from '../js/link.js';
```

ファイル末尾に追記:

```js
test('linkedEventIds: truthy な eventId だけ集める', () => {
  assert.deepEqual(
    linkedEventIds([{ eventId: 'e1' }, { name: 'x' }, { eventId: 'e3' }]),
    ['e1', 'e3'],
  );
});

test('linkedEventIds: 空配列', () => {
  assert.deepEqual(linkedEventIds([]), []);
});

test('linkedEventIds: eventId 未設定のみは空', () => {
  assert.deepEqual(linkedEventIds([{ name: 'a' }, { name: 'b' }]), []);
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npm test`
Expected: FAIL（`linkedEventIds` 未定義）

- [ ] **Step 3: link.js に実装を追記**

`js/link.js` の末尾に追記:

```js
// sights のうち eventId を持つものの id 配列を返す
export function linkedEventIds(sights) {
  return sights.filter((s) => s && s.eventId).map((s) => s.eventId);
}
```

- [ ] **Step 4: テストを実行して成功を確認**

Run: `npm test`
Expected: PASS（既存32 + 新規3 = 35テスト全緑）

- [ ] **Step 5: コミット**

```bash
git add js/link.js tests/link.test.js
git commit -m "feat: linkedEventIds helper for city deletion cleanup"
```

---

## Task 2: places.js に削除UIを追加（全置換）＋CSS

**Files:**
- Modify: `js/places.js`（全置換）
- Modify: `css/styles.css`（末尾に追記）

- [ ] **Step 1: places.js を全置換**

`js/places.js` を以下で全置換:

```js
import { update } from './store.js';
import { openEditor } from './editor.js';
import { findLinkedEvent, linkedEventIds } from './link.js';

export function renderPlaces(root, state) {
  for (const city of state.cities) {
    const card = document.createElement('div');
    card.className = 'card';
    const doneCount = city.sights.filter((s) => s.done).length;
    card.innerHTML =
      `<div class="day-head" style="margin:0 0 6px">` +
      `<span class="date">${city.name}</span>` +
      `<span class="weekday">${city.days}・${doneCount}/${city.sights.length} 達成</span></div>`;

    const header = card.querySelector('.day-head');
    const cityDel = document.createElement('button');
    cityDel.className = 'city-delete';
    cityDel.textContent = '🗑';
    cityDel.title = 'この都市を削除';
    cityDel.addEventListener('click', () => {
      if (!confirm(`「${city.name}」を削除しますか？関連する旅程の予定も削除されます。`)) return;
      update((s) => {
        const c = s.cities.find((x) => x.name === city.name);
        if (!c) return;
        const ids = linkedEventIds(c.sights);
        s.events = s.events.filter((e) => !ids.includes(e.id));
        s.cities = s.cities.filter((x) => x.name !== city.name);
      });
    });
    header.appendChild(cityDel);

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

      const sightDel = document.createElement('button');
      sightDel.className = 'sight-delete';
      sightDel.textContent = '✕';
      sightDel.title = 'この見どころを削除';
      sightDel.addEventListener('click', () => {
        if (findLinkedEvent(state.events, sight)) {
          if (!confirm('この見どころとリンクした旅程の予定も削除しますか？')) return;
        }
        update((s) => {
          const c = s.cities.find((x) => x.name === city.name);
          if (!c) return;
          const sgt = c.sights[i];
          if (sgt && sgt.eventId) {
            const idx = s.events.findIndex((e) => e.id === sgt.eventId);
            if (idx >= 0) s.events.splice(idx, 1);
          }
          c.sights.splice(i, 1);
        });
      });
      actions.appendChild(sightDel);

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

- [ ] **Step 2: css/styles.css の末尾に削除ボタンのスタイルを追記**

`css/styles.css` の末尾に追記:

```css
/* 行き先の削除ボタン */
.city-delete { margin-left: auto; border: none; background: none; color: var(--muted); font-size: 0.95rem; cursor: pointer; }
.sight-delete { border: none; background: none; color: var(--muted); font-size: 0.9rem; cursor: pointer; padding: 0 2px; }
```

- [ ] **Step 3: 構文チェック＆全テスト**

Run: `node --check js/places.js && npm test`
Expected: 構文OK、テスト35件全パス

- [ ] **Step 4: コミット**

```bash
git add js/places.js css/styles.css
git commit -m "feat: delete cities and sights in places tab (with linked-event cleanup)"
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

- [ ] **Step 2: 都市削除を確認**

`http://localhost:5180/?trip=test-del-001` を開き、行き先タブで `confirm` を自動承認する設定にして（Playwright の dialog 自動 accept、または `window.confirm = () => true` を evaluate で差し込む）、ローマカードの `.city-delete` をクリック→ローマカードが消えることを確認。発火例:

```js
() => {
  window.confirm = () => true;
  const cards = [...document.querySelectorAll('.card')];
  const roma = cards.find((c) => c.textContent.includes('ローマ') && c.querySelector('.city-delete'));
  roma.querySelector('.city-delete').click();
  const stillRoma = [...document.querySelectorAll('.card')].some((c) => c.textContent.includes('バチカン市国'));
  return { romaRemoved: !stillRoma };
};
```

- [ ] **Step 3: 見どころ削除（リンク無し）を確認**

ある都市の見どころ（旅程未追加）の `.sight-delete` をクリック→その行が消えることを確認（リンク無しは確認なしで即削除）。

- [ ] **Step 4: 見どころ削除（リンク有り）＋都市削除の予定連動を確認**

- 見どころを「🗓 旅程に追加」で旅程に追加→その見どころの `.sight-delete`（`window.confirm=()=>true`）→見どころと旅程の該当予定の両方が消えることを確認
- 別の見どころを旅程に追加→その都市カードを `.city-delete`→都市と、その都市のリンク予定が旅程から消えることを確認

- [ ] **Step 5: Firestore同期を確認**

同じ `?trip=test-del-001` を2タブで開き、一方で都市削除→もう一方（リロードなし）に反映されることを確認。

- [ ] **Step 6: 問題があれば修正してコミット**

```bash
git add -A
git commit -m "fix: adjustments from places-delete verification"
```
（修正が無ければスキップ）

- [ ] **Step 7: サーバ停止・一時ファイル削除**

`tmp-server.cjs` を削除し、ポート5180のプロセスを停止する。

---

## Task 4: 公開（main へ反映 → GitHub Pages 自動更新）

**Files:** なし（デプロイ）

- [ ] **Step 1: push**

```bash
git push origin main
```

- [ ] **Step 2: 本番で最終確認**

1〜2分後、`https://gfd-creators.github.io/honeymoon-planner/` を開き、行き先タブで都市🗑・見どころ✕が表示され削除が動作することを確認。`js/places.js` の更新が配信される（`city-delete` を含む）まで待ってから確認。コンソールに favicon 以外のエラーが出ないこと。

---

## Self-Review メモ（spec 対応確認）

- 都市カードに🗑＋確認→都市削除＋リンク予定削除 → Task 2（cityDel, linkedEventIds で events フィルタ）
- 見どころ行に✕→リンク無し即削除／有りは確認＋予定削除 → Task 2（sightDel, findLinkedEvent で分岐）
- linkedEventIds の単体テスト → Task 1
- 後方互換（eventId 未設定で動作）→ Task 1（filter truthy）, Task 2（findLinkedEvent null）
- Firestore 同期維持 → store.update 経由（変更なし）, Task 3 Step 5 で検証

全 spec 要件にタスク対応。プレースホルダ無し。関数名整合（linkedEventIds/findLinkedEvent、クラス city-delete/sight-delete）一貫。
