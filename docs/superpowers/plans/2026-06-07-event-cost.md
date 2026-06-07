# 旅程の料金入力＋予算の実費集計 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 予定の編集シートに料金とカテゴリを入力でき、予算タブで旅程の料金を「実費」としてカテゴリ別に集計し合計を表示する。

**Architecture:** 集計ロジック（totalCost / costByCategory / COST_CATEGORIES）を純粋関数として `budget.js` に追加し単体テスト。`editor.js` に入力欄、`budgetView.js` に実費セクション、`timeline.js` のリストカードに料金表示を足す。データは event に任意 `cost`/`costCategory` を持たせるだけ（後方互換）。

**Tech Stack:** Vanilla JS (ES Modules), Node 組み込みテスト (`node --test`), GitHub Pages。

---

## ファイル構成

```
js/
├ budget.js     — 変更。COST_CATEGORIES / totalCost / costByCategory 追加（純粋・テスト）
├ editor.js     — 変更。料金・カテゴリ入力欄、保存に cost/costCategory
├ budgetView.js — 変更。合計カードに実費合計、実費セクション
├ timeline.js   — 変更。リストカードに料金表示
tests/
└ budget.test.js — 変更。totalCost / costByCategory のテスト
```

`store.js` / `weekview.js` / `drag.js` / `week.js` / `places.js` / `link.js` / `seed.js` / `css` は変更しない（既存クラス再利用）。

---

## Task 1: budget.js に集計関数を追加（TDD）

**Files:**
- Modify: `js/budget.js`（末尾に追加）
- Modify: `tests/budget.test.js`（import 更新＋テスト追加）

- [ ] **Step 1: 失敗するテストを追記**

`tests/budget.test.js` 先頭の import 行を以下に置き換える:

```js
import { totalPlanned, totalActual, perPerson, toEUR, remaining, totalCost, costByCategory, COST_CATEGORIES } from '../js/budget.js';
```

ファイル末尾に追記:

```js
const costEvents = [
  { cost: 50000, costCategory: '航空券' },
  { cost: 3000, costCategory: '食事' },
  { cost: 2000, costCategory: '食事' },
  { cost: 1000, costCategory: '' },     // 未分類
  { cost: 500, costCategory: '謎' },    // 未知カテゴリ→未分類
  { cost: 0, costCategory: '航空券' },  // 0は除外
  { costCategory: '食事' },              // cost無し→除外
];

test('COST_CATEGORIES に主要カテゴリが含まれる', () => {
  assert.ok(COST_CATEGORIES.includes('航空券'));
  assert.ok(COST_CATEGORIES.includes('食事'));
});

test('totalCost: cost の総和（無効値・空は0）', () => {
  assert.equal(totalCost(costEvents), 56500);
  assert.equal(totalCost([]), 0);
  assert.equal(totalCost([{ cost: 'x' }, {}]), 0);
});

test('costByCategory: カテゴリ別集計＋未分類を末尾にまとめる', () => {
  assert.deepEqual(costByCategory(costEvents), [
    { category: '航空券', amount: 50000 },
    { category: '食事', amount: 5000 },
    { category: '未分類', amount: 1500 },
  ]);
});

test('costByCategory: 空配列は空', () => {
  assert.deepEqual(costByCategory([]), []);
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npm test`
Expected: FAIL（totalCost 等が未定義）

- [ ] **Step 3: budget.js に実装を追記**

`js/budget.js` の末尾に追記:

```js
// 料金カテゴリの固定リスト（編集シートの選択肢・集計表示順）
export const COST_CATEGORIES = ['航空券', 'ホテル', '食事', '交通', '観光チケット', 'Wi-Fi・eSIM', '海外保険', '前撮り', 'その他'];

// events の cost 総和
export function totalCost(events) {
  return events.reduce((acc, e) => acc + (Number(e.cost) || 0), 0);
}

// cost>0 の予定をカテゴリ別に集計。COST_CATEGORIES 順、未知/空は「未分類」として末尾に1件
export function costByCategory(events) {
  const map = new Map();
  let uncategorized = 0;
  for (const e of events) {
    const c = Number(e.cost) || 0;
    if (c <= 0) continue;
    const cat = e.costCategory;
    if (cat && COST_CATEGORIES.includes(cat)) {
      map.set(cat, (map.get(cat) || 0) + c);
    } else {
      uncategorized += c;
    }
  }
  const out = [];
  for (const cat of COST_CATEGORIES) {
    if (map.has(cat)) out.push({ category: cat, amount: map.get(cat) });
  }
  if (uncategorized > 0) out.push({ category: '未分類', amount: uncategorized });
  return out;
}
```

- [ ] **Step 4: テストを実行して成功を確認**

Run: `npm test`
Expected: PASS（既存39 + 新規4 = 43テスト全緑）

- [ ] **Step 5: コミット**

```bash
git add js/budget.js tests/budget.test.js
git commit -m "feat: totalCost/costByCategory/COST_CATEGORIES for itinerary costs"
```

---

## Task 2: editor.js に料金・カテゴリ入力欄を追加

**Files:**
- Modify: `js/editor.js`

- [ ] **Step 1: COST_CATEGORIES を import**

`js/editor.js` 先頭の import を変更。
変更前:

```js
import { update } from './store.js';
```

変更後:

```js
import { update } from './store.js';
import { COST_CATEGORIES } from './budget.js';
```

- [ ] **Step 2: カテゴリの option を生成**

`typeOptions` を定義している行の直後に追加。
変更前:

```js
  const typeOptions = TYPES.map((t) =>
    `<option value="${t.value}"${t.value === ev.type ? ' selected' : ''}>${t.label}</option>`).join('');
```

変更後:

```js
  const typeOptions = TYPES.map((t) =>
    `<option value="${t.value}"${t.value === ev.type ? ' selected' : ''}>${t.label}</option>`).join('');
  const costCatOptions = ['<option value="">（未分類）</option>']
    .concat(COST_CATEGORIES.map((c) =>
      `<option value="${c}"${c === (ev.costCategory || '') ? ' selected' : ''}>${c}</option>`))
    .join('');
```

- [ ] **Step 3: 料金・カテゴリの入力欄を innerHTML に挿入**

編集シートの innerHTML 内、ヒント文の直前に料金行を挿入。
変更前:

```js
    <p class="editor-hint">開始を空にすると「終日」になります</p>
```

変更後:

```js
    <div class="editor-row">
      <label class="editor-field">料金（円）
        <input class="edit" id="ed-cost" type="number" min="0" step="100" value="${ev.cost || ''}" placeholder="例: 12000" />
      </label>
      <label class="editor-field">カテゴリ
        <select class="edit" id="ed-costcat">${costCatOptions}</select>
      </label>
    </div>
    <p class="editor-hint">開始を空にすると「終日」になります</p>
```

- [ ] **Step 4: 保存 patch に cost / costCategory を追加**

保存ハンドラの patch を変更。
変更前:

```js
    const patch = {
      title,
      type: sheet.querySelector('#ed-type').value,
      date: sheet.querySelector('#ed-date').value,
      time: sheet.querySelector('#ed-time').value,
      endTime: sheet.querySelector('#ed-endtime').value,
    };
```

変更後:

```js
    const patch = {
      title,
      type: sheet.querySelector('#ed-type').value,
      date: sheet.querySelector('#ed-date').value,
      time: sheet.querySelector('#ed-time').value,
      endTime: sheet.querySelector('#ed-endtime').value,
      cost: Number(sheet.querySelector('#ed-cost').value) || 0,
      costCategory: sheet.querySelector('#ed-costcat').value,
    };
```

- [ ] **Step 5: 構文チェック＆全テスト**

Run: `node --check js/editor.js && npm test`
Expected: 構文OK、テスト43件全パス

- [ ] **Step 6: コミット**

```bash
git add js/editor.js
git commit -m "feat: cost and category fields in event editor"
```

---

## Task 3: budgetView.js に実費セクションを追加

**Files:**
- Modify: `js/budgetView.js`

- [ ] **Step 1: import に totalCost / costByCategory を追加**

`js/budgetView.js` 先頭の import を変更。
変更前:

```js
import { totalPlanned, totalActual, perPerson, toEUR, remaining } from './budget.js';
```

変更後:

```js
import { totalPlanned, totalActual, perPerson, toEUR, remaining, totalCost, costByCategory } from './budget.js';
```

- [ ] **Step 2: 実費の合計とカテゴリ別を算出**

`const planned = totalPlanned(items);` の直後に追加。
変更前:

```js
  const planned = totalPlanned(items);
```

変更後:

```js
  const planned = totalPlanned(items);
  const cost = totalCost(state.events);
  const byCat = costByCategory(state.events);
```

- [ ] **Step 3: 合計カードに実費合計の行を追加**

合計カードの innerHTML を変更。
変更前:

```js
    `<div class="sub">実績 ¥${totalActual(items).toLocaleString()}` +
    `（残 ¥${remaining(items).toLocaleString()}）</div>`;
```

変更後:

```js
    `<div class="sub">実績 ¥${totalActual(items).toLocaleString()}` +
    `（残 ¥${remaining(items).toLocaleString()}）</div>` +
    `<div class="sub">🧾 実費合計 ¥${cost.toLocaleString()}</div>`;
```

- [ ] **Step 4: 実費セクションのカードを追加**

内訳カードを append した後（`root.appendChild(breakdown);` の直後、ヒントの前）に実費カードを挿入。
変更前:

```js
  root.appendChild(breakdown);

  const hint = document.createElement('p');
```

変更後:

```js
  root.appendChild(breakdown);

  // 旅程の実費セクション
  const actuals = document.createElement('div');
  actuals.className = 'card';
  let actualsHtml = '<div class="day-head" style="margin:0 0 8px"><span class="date">🧾 旅程の実費</span></div>';
  if (byCat.length === 0) {
    actualsHtml += '<p class="sub">旅程の予定に料金を入れると、ここに集計されます</p>';
  } else {
    byCat.forEach((c) => {
      actualsHtml += `<div class="bar-row"><div class="label"><span>${c.category}</span>` +
        `<span>¥${c.amount.toLocaleString()}</span></div></div>`;
    });
    actualsHtml += `<div class="label" style="font-weight:700;margin-top:8px">` +
      `<span>実費合計</span><span>¥${cost.toLocaleString()}</span></div>`;
  }
  actuals.innerHTML = actualsHtml;
  root.appendChild(actuals);

  const hint = document.createElement('p');
```

- [ ] **Step 5: 構文チェック＆全テスト**

Run: `node --check js/budgetView.js && npm test`
Expected: 構文OK、テスト43件全パス

- [ ] **Step 6: コミット**

```bash
git add js/budgetView.js
git commit -m "feat: itinerary actual-cost section in budget tab"
```

---

## Task 4: timeline.js のリストカードに料金表示

**Files:**
- Modify: `js/timeline.js`

- [ ] **Step 1: eventCard に料金 meta を追加**

`eventCard` の innerHTML 組み立てを変更。
変更前:

```js
  el.innerHTML =
    timeHtml +
    `<div class="ttl">${flightBadge}${layover}${ev.title}</div>` +
    (ev.hotel ? `<div class="meta">🏨 宿: ${ev.hotel}</div>` : '') +
    (mealLabel(ev.meals) ? `<div class="meta">${mealLabel(ev.meals)}</div>` : '');
```

変更後:

```js
  el.innerHTML =
    timeHtml +
    `<div class="ttl">${flightBadge}${layover}${ev.title}</div>` +
    (ev.hotel ? `<div class="meta">🏨 宿: ${ev.hotel}</div>` : '') +
    (mealLabel(ev.meals) ? `<div class="meta">${mealLabel(ev.meals)}</div>` : '') +
    (ev.cost > 0 ? `<div class="meta">💴 ¥${Number(ev.cost).toLocaleString()}` +
      `${ev.costCategory ? `（${ev.costCategory}）` : ''}</div>` : '');
```

- [ ] **Step 2: 構文チェック＆全テスト**

Run: `node --check js/timeline.js && npm test`
Expected: 構文OK、テスト43件全パス

- [ ] **Step 3: コミット**

```bash
git add js/timeline.js
git commit -m "feat: show cost on list event cards"
```

---

## Task 5: ブラウザ実機確認（Playwright）

**Files:** なし（検証のみ）

- [ ] **Step 1: ローカルサーバ起動**

プロジェクト直下に `tmp-server.cjs` を作成して起動:

```js
const http=require('http'),fs=require('fs'),path=require('path'),root=__dirname;
const t={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8'};
http.createServer((q,s)=>{let u=decodeURIComponent(q.url.split('?')[0]);if(u==='/')u='/index.html';const fp=path.join(root,u);if(!fp.startsWith(root)){s.writeHead(403);s.end();return;}fs.readFile(fp,(e,d)=>{if(e){s.writeHead(404);s.end();return;}s.writeHead(200,{'Content-Type':t[path.extname(fp)]||'application/octet-stream'});s.end(d);});}).listen(5180,()=>console.log('up'));
```

`curl -s -o /dev/null -w "%{http_code}" http://localhost:5180/index.html` が `200`。

- [ ] **Step 2: 料金入力→リスト表示を確認**

`http://localhost:5180/?trip=test-cost-001` を開き、旅程リストで予定をタップ→編集シートに「料金」「カテゴリ」欄があることを確認。例として料金 12000・カテゴリ 食事を入力して保存→そのカードに「💴 ¥12,000（食事）」が出ることを `browser_evaluate` で確認。

- [ ] **Step 3: 予算タブの実費集計を確認**

別の予定にも料金（例: 50000・航空券、3000・食事）を入力。予算タブを開き、「🧾 旅程の実費」セクションに航空券 ¥50,000 / 食事 ¥15,000 のようにカテゴリ別が出て、「実費合計」と上部カードの「🧾 実費合計」が一致することを確認（スクリーンショット）。

- [ ] **Step 4: 未分類・後方互換を確認**

カテゴリ未選択（未分類）で料金だけ入れた予定が「未分類」に集計されること、料金未入力の予定は集計に出ないこと、料金ゼロのトリップでは案内文が出ることを確認。

- [ ] **Step 5: Firestore同期を確認**

同じ `?trip=test-cost-001` を2タブで開き、一方で料金入力→もう一方（リロードなし）の予算タブに反映されることを確認。

- [ ] **Step 6: 問題があれば修正してコミット**

```bash
git add -A
git commit -m "fix: adjustments from event-cost verification"
```
（修正が無ければスキップ）

- [ ] **Step 7: サーバ停止・一時ファイル削除**

`tmp-server.cjs` を削除し、ポート5180のプロセスを停止する。

---

## Task 6: 公開（main へ反映 → GitHub Pages 自動更新）

**Files:** なし（デプロイ）

- [ ] **Step 1: push**

```bash
git push origin main
```

- [ ] **Step 2: 本番で最終確認**

1〜2分後、`https://gfd-creators.github.io/honeymoon-planner/` を開き、料金入力と予算の実費集計が動作することを確認。`js/budget.js` の更新が配信される（`costByCategory` を含む）まで待つ。コンソールに favicon 以外のエラーが出ないこと。

---

## Self-Review メモ（spec 対応確認）

- 編集シートに料金・カテゴリ → Task 2
- カテゴリ固定リスト（未分類含む）→ Task 1（COST_CATEGORIES）, Task 2（option 先頭に空）
- リストカードに料金表示 → Task 4
- 予算タブに実費セクション（カテゴリ別＋未分類末尾）→ Task 3（costByCategory）
- 実費合計表示（セクション＋上部カード）→ Task 3（totalCost）
- 既存の予算（見積もり）内訳は維持 → Task 3（breakdown はそのまま、実費は別カード）
- 後方互換（cost 未設定で動作）→ Task 1（Number||0）, Task 4（ev.cost>0 ガード）
- 集計の単体テスト → Task 1

全 spec 要件にタスク対応。プレースホルダ無し。関数名整合（totalCost/costByCategory/COST_CATEGORIES、cost/costCategory）一貫。
